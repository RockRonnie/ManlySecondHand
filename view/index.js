'use strict';
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const app = express();
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const resize = require('../model/utils/resize');
const pass = require('../model/utils/pass');
const query = require('../model/utils/DB_Query');
const fs      = require('fs');
const https   = require('https');
const sslkey  = fs.readFileSync('/etc/pki/tls/private/ca.key');
const sslcert = fs.readFileSync('/etc/pki/tls/certs/ca.crt');
const options = {
  key: sslkey,
  cert: sslcert
};

app.use(express.static('view/public'));
app.use(require('serve-static')(__dirname + './public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(session({
  secret: 'keyboardcat',
  resave: false,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

//logging in, redirecting to pass.login
app.post('/login', pass.login, (req, res) => {
  console.log('login consolessa on käyty');
  console.log(req.session.user);
});
//registering, redirecting to pass.register and pass.login.
app.post('/register', pass.register, pass.login);

//folder used for storing the images
const upload = multer({dest: 'view/public/uploads/'});

app.get('/user', pass.loggedIn, (req, res) => {
  const sess = req.session.user;
  console.log('userp app käyty');
  console.log(sess.UserName);
  res.send(sess);
});

app.use('/product', (req, res) => {
            const data = [
                req.body.name,
                req.body.brand,
                req.body.description,
                "not",
                parseInt(req.body.condition),
                req.body.ptype,
                parseInt(req.body.price),
                parseInt(req.body.id), // dummy userID
                ];
                console.log(data);
                query.insertProduct(data);
                query.selectLatestProduct((result) => {
                    console.log(result);
                    res.send(result);
                });
});
// adding the images, resizing them
app.post('/image', upload.single('imgA'), (req, res, next) => {
    console.log("adding the image");
    next();
});
app.use('/image', (req, res, next) => {
    // tee pieni thumbnail
    resize.makeResize(req.file.path, 300, 'view/public/thumbs/' + req.file.filename).then(data => {
        next();
    });
});

app.use('/image', (req, res, next) => {
    // tee iso thumbnail
    resize.makeResize(req.file.path, 640, 'view/public/medium/' + req.file.filename).
    then(data => {
        next();
    });
});
app.use('/image', (req, res, next) => {
    // Add image to the database
    //Title, Location, Alt, Thumb, Medium, pID
    console.log(req);
    console.log("adding image to the database")
    const data = [
        req.body.title,
        'uploads/' + req.file.filename,
        req.body.title,
        'thumbs/' + req.file.filename,
        'medium/' + req.file.filename,
        req.body.id, // linked product's id
    ];
    query.insertImage(data, res);
    console.log(data)
});
//getting the usersession to frontend
app.get('/getsession', (req, res) => {
  res.json(req.session.user);
});
//used for logging out
app.get('/logout', (req,res)=>{
   req.logout();
   req.session.destroy();
   res.send("logged out");
});

// Use user selected filters to run a SQL query
app.post('/getproduct', (req, res) => {
  console.log('1. Funktio alkaa');
  const data = req.body.searchp.toString();
  const qdata = data.split(",");
  //Bake a sweet custom SQL query
  const mysql = 'SELECT * FROM Product JOIN User On User.uID = Product.uID JOIN Image ON Image.pID = Product.pID WHERE ';
  let q0;
  let q1;
  let q2;
  let q3;
// searchp (selected filters) contain '*' if the filter was not selected. SQL query is built based on this information
  if (qdata[0] != '*') {
    q0 = 'pType = ' + '"'+qdata[0]+'" AND ' // IF filter == selected DO use this part
  }
  else {
    q0 = '' // IF not, be empty
  }
  if (qdata[1] != '*') {
    q1 = 'pBrand = ' + '"'+qdata[1]+'" AND '
  }
  else {
    q1 = ''
  }
  if (qdata[2] != '*') {
    q2 = 'pCondition BETWEEN ' + qdata[2] + ' AND 10 AND '
  }
  else {
    q2 = ''
  }
  if (qdata[3] != '*' && qdata[4] != '*') {
    q3 = 'Price BETWEEN ' +qdata[3] + ' AND ' +qdata[4] +' AND '
  }
  else {
    q3 = ''
  }


  const sql = [mysql+q0+q1+q2+q3+'Product.pID IS NOT NULL;']; // Previous parts end in AND so this is a failsafe to make a complete query. pID IS NOT NULL returns always true.
  console.log(sql);
  // Run a callback SQL query based on the previous Build-A-SQL setup.
  query.selectProductInfo(sql, (result) => {
  console.log('2. queryn jälkeen');
  res.send(result);
})});

app.post('/getown',(req, res) => {
  const sqdata = [req.body.uprod];
  console.log('getown ' + sqdata);

  query.selectUserProducts(sqdata, (result) => {
    res.send(result)
  });
});

app.listen(3000); //normal http traffic
https.createServer(options, app).listen(8000); //https traffic

console.log('Server is starting');
console.log('Rullaa');
