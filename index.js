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
		type: mongoose.Schema.Types.String,
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
	type Mutation {
		createUrl(url: String!, title: String!): Url
	}
	type Subscription {
		urlCreated: Url
	}
`;

const resolvers = {

	Query: { urls: () => Url.find(), },
	Mutation: {
		createUrl: async (_, { url, title }, { pubsub }) => {
			const newUrl = new Url({ url, title });
			await newUrl.save();
			pubsub.publish("urlCreated", newUrl)
			return newUrl;
		},
	},
	Subscription: {
		urlCreated: {
			resolve: (payload) => {
				payload.title = '#' + payload.title;
				return payload;
			},
			subscribe: (parent, args, { pubsub }) => pubsub.asyncIterator("urlCreated")
		}
	},
};

async function main () {

	const pubsub = new PubSub()
	const server = new ApolloServer({ typeDefs, resolvers, context: { pubsub } });

	await mongoose.connect("mongodb://localhost:27017/favurl", {
		useCreateIndex: true,
		useNewUrlParser: true,
		useUnifiedTopology: true,
	});

	server.listen().then(({ url }) => {
		console.log(`Server ready at ${url}`);
	});
}

main();