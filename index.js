const { ApolloServer, gql } = require('apollo-server')
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose')
const Author = require('./models/Author')
const Book = require('./models/Book')
require('dotenv').config()

console.log('connecting to', process.env.MONGO_URI)

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
    .then(() => {
      console.log('connected to MongoDB')
    })
    .catch((error) => {
      console.log('error connection to MongoDB:', error.message)
    })

const typeDefs = gql`
  
  type Query {
      bookCount: Int!
      authorCount: Int!
      allBooks(name: String, genre: String): [Book!]!
      allAuthors: [Author!]!
  }
  type Author {
    name: String!
    born: Int
    bookCount: Int!
  }
  type Book {
    title: String!
    published: Int!
    author: Author
    id: ID!
    genres: [String]!
  }
  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String]!
    ) : Book
    editAuthor(
      name: String!
      setBornTo: Int!
    ) : Author
  }
`

const resolvers = {
  Query: {
      bookCount: () => Book.collection.countDocuments(),
      authorCount: () => Author.collection.countDocuments(),
      allBooks: async (root, args) => {
        if (args.name && args.genre) {
          return books.filter(book => book.author === args.name)
              .filter(book => book.genres.includes(args.genre))
        } else if (args.name) {
          return books.filter(book => book.author === args.name)
        } else if (args.genre) {
          return Book.find({genres: {$in : args.genre}}).populate('author')
        } else {
          return Book.find({}).populate('author')
        }
      },
      allAuthors: () => Author.find({})
  },
  Author: {
      bookCount: async (root) => {
          const books = await Book.find({}).populate('author')
          return books.filter(b => b.author.name === root.name).length
      }
  },
  Book: {
    author: async (root) => {
      const b = await Book.findOne({title : root.title}).populate('author')
      const authorFound = await Author.findOne({name: b.author.name})
      authorFound ? console.log(`test ${authorFound}`) : console.log(`no auth`)
      return {
        name: authorFound.name,
        born: authorFound.born
      }
    }
  },
  Mutation: {
      addBook: async (root, args) => {
        const author = await Author.find({name: args.author})
        console.log(`author id is ${typeof author[0]}`)
        author ? console.log(author[0]._id) : await Author.save({name: args.author})
        const newBook = new Book({title: args.title, published: args.published, genres: args.genres, author: author[0]._id})
        console.log(newBook)
        return newBook.save()
      },
      editAuthor: async (root, args) => {
        const authorFound = await Author.findOne({name: args.name})
        if (authorFound) {
          authorFound.born = args.setBornTo
          return authorFound.save()
        } else {
          return null
        }
      }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: {origin: '*',			// <- allow request from all domains
    credentials: true}
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})