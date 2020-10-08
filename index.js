
const { ApolloServer, gql, UserInputError, AuthenticationError } = require('apollo-server')
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose')
const Author = require('./models/Author')
const Book = require('./models/Book')
const User = require('./models/User')
const jwt = require('jsonwebtoken')

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
      me: User
  }
  type User {
      username: String!
      favoriteGenre: String!
      id: ID!
  }

  type Token {
      value: String!
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
   createUser(
          username: String!
          favoriteGenre: String!
      ): User
    login(
          username: String!
          password: String!
      ): Token
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
      allAuthors: () => Author.find({}),
      me: () => (root, args, context) => {
          return context.currentUser
      }
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
    createUser: async (root, args) => {
        const user = new User({
            username: args.username,
            favoriteGenre: args.favoriteGenre
        })
        try {
            await user.save()
        } catch (e) {
            throw new UserInputError(e.message, {
                invalidArgs: args,
            })
        }
        return user
    },
    login: async (root, args) => {
        const user = await User.findOne({ username: args.username })

        if ( !user || args.password !== 'cheese' ) {
            throw new UserInputError("wrong credentials")
        }

        const userForToken = {
            username: user.username,
            id: user._id,
        }

        return { value: jwt.sign(userForToken, process.env.SECRET) }
    },
      addBook: async (root, args, {currentUser}) => {
        if (!currentUser) {
            throw new AuthenticationError("not authenticated")
        }
        let author = await Author.find({name: args.author})
        let authorId
        if (!author[0]) {
            console.log(`author is undefined`)
            const newAuthor = new Author({name: args.author})
            try {
                author = await newAuthor.save()
            } catch (e) {
                throw new UserInputError(e.message, {
                    invalidArgs: args,
                })
            }
            authorId =  author._id
        } else {
            authorId =  author[0]._id
        }

        const newBook = new Book({title: args.title, published: args.published, genres: args.genres, author: authorId})
        console.log(newBook)
        try {
            await newBook.save()
        } catch (e) {
            throw new UserInputError(e.message, {
                invalidArgs: args,
            })
        }
        return newBook
      },
      editAuthor: async (root, args, {currentUser}) => {
        if (!currentUser) {
            throw new AuthenticationError("not authenticated")
        }
        const authorFound = await Author.findOne({name: args.name})
        authorFound.born = args.setBornTo
        try {
            await authorFound.save()
        } catch (error) {
            throw new UserInputError(error.message, {
                invalidArgs: args,
            })
        }
        return authorFound
      }
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: {origin: '*',			// <- allow request from all domains
    credentials: true},
  context: async ({ req }) => {
      const auth = req ? req.headers.authorization : null
      if (auth && auth.toLowerCase().startsWith('bearer ')) {
          const decodedToken = jwt.verify(auth.substring(7), process.env.SECRET)
          const currentUser = await User.findById(decodedToken.id)
          return { currentUser }
      }
  }
})

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`)
})