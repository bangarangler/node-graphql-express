require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
//const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const graphqlhttp = require('express-graphql');

const graphqlSchema = require('./graphql/schema.js');
const graphqlResolver = require('./graphql/resolvers.js');
const auth = require('./middleware/auth.js');
const { clearImage } = require('./util/file.js');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

//const feedRoutes = require('./routes/feed.js');
//const authRoutes = require('./routes/auth.js');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a' }
);

app.use(helmet());
app.use(compression());
app.use(morgan('combined', { stream: accessLogStream }));

//app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use(multer({storage: fileStorage, fileFilter: fileFilter}).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')));
//app.use(cors());

app.use((req, res, next) => {
  res.setHeader(`Access-Control-Allow-Origin`, `*`);
  res.setHeader(
    `Access-Control-Allow-Methods`,
    `OPTIONS, GET, POST, PUT, PATCH, DELETE`,
  );
  res.setHeader(`Access-Control-Allow-Headers`, `Content-Type, Authorization`);
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not Authenticated!')
  }
  if (!req.file) {
    return res.status(200).json({ message: "No file provided!" });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  return res.status(201).json({ message: 'File stored.', filePath: req.file.path })
})

app.use(
  '/graphql',
  graphqlhttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || 'An error occured.';
      const code = err.originalError.code || 500;
      return {
        message: message,
        status: code,
        data: data,
      };
    },
  }),
);

//app.use('/feed', feedRoutes);
//app.use('/auth', authRoutes);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({message: message, data: data});
});

mongoose
  .connect(
    `mongodb+srv://${process.env.MONGO_USER}:${
      process.env.MONGO_PW
    }@restnode-vrbbu.mongodb.net/messages`,
    {useNewUrlParser: true},
  )
  .then(result => {
    app.listen(process.env.PORT || 8080);
    //const server = app.listen(8080);
    //const io = require('./socket').init(server);
    //io.on('connection', socket => {
    //console.log('Client connected')
    //})
  })
  .catch(err => console.log(err));

