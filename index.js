import { ApolloServer, gql, PubSub } from "apollo-server";
import mongoose from "mongoose";
const Url = mongoose.model("Url", new mongoose.Schema({
	url: {
		type: mongoose.Schema.Types.String,
		required: true,
		unique: true,
		index: true,
		lowercase: true,
		collation: { locale: 'en', strength: 2 },
	},
	title: {
		type: mongoose.Schema.Types.Mixed,
		required: true,
	},
}) );
const typeDefs = gql`
	type Query {
		urls: [Url!]!
	}
	type Url {
		id: ID!
		url: String!
		title: String!
	}
	type Status {
		error: Boolean!
		message: String!
		data: Url
	}
	type UpdatedField {
		id: String!
		field: String!
		value: String
	}
	type Mutation {
		createUrl(url: String!, title: String!): Status!
		deteleUrl(urlId: String!): Status!
		updateUrl(urlId: String!, field: String!, value: String): Status!
	}
	type Subscription {
		urlCreated: Url
		urlRemoved: Url
		urlUpdated: UpdatedField
	}
`;
const resolvers = {
	Query: { urls: () => Url.find(), },
	Url: {
		url: ( url ) => url.url || "",
		title: ( url ) => url.title || "",
	},
	Mutation: {
		createUrl: async (_, { url, title }, { pubSub }) => {
			try {
				const newUrl = new Url({ url, title });
				const saveUrl = await newUrl.save();
				pubSub.publish("urlCreated", saveUrl);
				return { error: false, message: "OK", data: saveUrl };
			} catch(error) {
				return { error: true, message: error.errmsg, data: null };
			}
		},
		deteleUrl: async (_, { urlId }, { pubSub }) => {
			try {
				const removeUrl = await Url.findOneAndDelete({ _id: urlId });
				pubSub.publish("urlRemoved", removeUrl);
				return { error: false, message: "OK", data: removeUrl };
			} catch(error) {
				return { error: true, message: error.message, data: null };
			}
		},
		updateUrl: async (_, { urlId, field, value }, { pubSub }) => {
			const updateUrl = await Url.findOneAndUpdate({ _id: urlId }, { [field]: value });
			pubSub.publish("urlUpdated", { id: urlId, field, value });
			return { error: false, message: "OK", data: updateUrl };
		},
	},
	Subscription: {
		urlCreated: {
			resolve: (payload) => {
				payload.title = '#' + payload.title;
				return payload;
			},
			subscribe: (parent, args, { pubSub }) => pubSub.asyncIterator("urlCreated")
		},
		urlRemoved: {
			resolve: (payload) => payload,
			subscribe: (parent, args, { pubSub }) => pubSub.asyncIterator("urlRemoved")
		},
		urlUpdated: {
			resolve: (payload) => payload,
			subscribe: (parent, args, { pubSub }) => pubSub.asyncIterator("urlUpdated")
		},
	},
};
async function main () {
	const pubSub = new PubSub()
	const server = new ApolloServer({ typeDefs, resolvers, context: { pubSub } });
	await mongoose.connect("mongodb://localhost:27017/favurl", {
		useCreateIndex: true,
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: true,
	});
	server.listen().then(({ url }) => console.log(`Server ready at ${url}`));
}
main();