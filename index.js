const Joi = require("joi");
const uuidv1 = require("uuid/v1");
const express = require("express"); //returns a function
jwt = require("jsonwebtoken"); // For authenticating and generating token
config = require("./config");
var cors = require("cors");
const app = express();

// Fixes error: CORS
app.use(cors());

// Enables json in a request body
app.use(express.json());

// For generating token
app.set("Secret", config.secret);

const {
  USER_ID,
  USER_CREATE_DATE /* TABLE_NAME, USER_NAME, INDEX_USER_NAME, USER_FIRST_NAME, USER_LAST_NAME, USER_PASSWORD */
} = require("./Constants");

// Importing DAL functions
const {
  getAllUsers,
  getUser,
  addUser,
  exist,
  alterUser,
  deleteUser,
  makeError // This shoule only be in the DAL!!!
} = require("./DAL");

// -------------------- HTTP Response functions -------------------

function sendSuccess(res, data) {
  var output = JSON.stringify({ error: null, data: data }) + "\n";
  res.status(200).send(output);
}

function sendFailure(res, err) {
  var output = JSON.stringify({ error: err.code, data: err.message }) + "\n";
  res.status(err.code).send(output);
}

// ------------------------------ helper functions ------------------------------

function validation(req, callback) {
  // create a joi schema for input validation
  const schema = {
    userName: Joi.string().required(),
    userFirstName: Joi.string(),
    userLastName: Joi.string(),
    userPassword: Joi.string()
  };
  //validation result
  const result = Joi.validate(req.body, schema);
  if (result.error) {
    callback(
      new makeError(
        400,
        "my validation error:\n" + result.error.details[0].message
      )
    );
  } else callback(null);
}

function validAndUnique(req, res, callback) {
  validation(req, err => {
    if (err) {
      sendFailure(res, err);
      return;
    }

    exist(req.body.userName, (ServerErr, existingUser) => {
      if (ServerErr) {
        sendFailure(res, serverErr);
      } else {
        callback(existingUser);
      }
    });
  });
}

//  -------------------- Token Authentication ----------------------

const ProtectedRoutes = express.Router();

// Which routs the middleware will verify the token
app.use("/api/users/bla/:id", ProtectedRoutes);

ProtectedRoutes.use((req, res, next) => {
  // check header for the token
  var token = req.headers["access-token"];

  // decode token
  if (token) {
    // verifies secret and checks if the token is expired
    jwt.verify(token, app.get("Secret"), (err, decoded) => {
      if (err) {
        // 401 code - unauthorized
        const WrongTokenErr = new makeError(401, `invalid token`);
        sendFailure(res, WrongTokenErr);
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });
  } else {
    // if there is no token
    const noTokenProvidedErr = new makeError(401, `No token provided`);
    sendFailure(res, noTokenProvidedErr);
  }
});

// ------------------------------ GET ------------------------------

app.get("/api/users", (req, res) => {
  console.log("webApi: GET -  all users ...");
  getAllUsers((err, allCustomers) => {
    if (err) {
      sendFailure(res, err);
    } else {
      sendSuccess(res, allCustomers);
    }
  });
});

app.get("/api/users/:id", (req, res) => {
  const name = req.params.id.toString();

  console.log(`webApi: GET - user: ${name} ...`);

  console.log("getting user: ", name);
  getUser(name, (err, retrievedUser) => {
    if (err) {
      sendFailure(res, err);
    } else {
      sendSuccess(res, retrievedUser);
    }
  });
});

// ------------------------------ POST ------------------------------

app.post("/api/users/login", (req, res) => {
  console.log("POST - Trying to login user: ", req.body.userName);

  validAndUnique(req, res, existingUser => {
    if (!existingUser.userPassword === req.body.userPassword) {
      const wrongPassword = new makeError(400, `wrong password or email.`);
      sendFailure(res, wrongPassword);
    } else {
      // Generate authenticatin token
      const payload = {
        check: true
      };
      const token = jwt.sign(payload, app.get("Secret"), {
        expiresIn: 1440 // expires in 24 hours
      });
      // Respond with token and 200
      const output =
        JSON.stringify({
          error: null,
          data: existingUser.userName,
          token: token
        }) + "\n";
      res.status(200).send(output);
    }
  });
});

app.post("/api/users", (req, res) => {
  validAndUnique(req, res, alreadyExists => {
    if (alreadyExists) {
      const notUniqueNameError = new makeError(
        400,
        `user name: ${req.body.userName} has already been used.`
      );
      sendFailure(res, notUniqueNameError);
      return;
    }

    // Create the user request
    const user = { ...req.body };
    user[USER_ID] = String(uuidv1()); // The id type is set to 'string' in the db
    user[USER_CREATE_DATE] = String(new Date());
    console.log("webApi:  POST - user request:\n", user.userName);

    //add the new user to db
    addUser(user, err => {
      // CHECK!!!! Maybe problem with seeing req, res objects from callback within callback
      if (err) {
        sendFailure(res, err);
      } else {
        //send the newly stored object back to client
        sendSuccess(res, user.userName);
      }
    });
  });
});

// ------------------------------ PUT -------------------------------

app.put("/api/users/:id", (req, res) => {
  console.log(`webApi: entered PUT ...`);

  // Look up the user
  // If doesn't exist, return 404
  const targetName = req.params.id.toString();
  exist(targetName, (severErr, exisingUser) => {
    if (severErr) {
      //sever error
      sendFailure(res, severErr);
    } else if (!exisingUser) {
      const noSuchUserErr = new makeError(
        400,
        `user name: ${req.body.userName} does NOT exist.`
      );
      sendFailure(res, noSuchUserErr);
    } else {
      validation(req, err => {
        if (err) {
          sendFailure(res, err);
          return;
        }
        // Update requiered fields here
        const updatedUser = { ...req.body };

        console.log(`webApi: PUT - user: ${updatedUser.userName} ...`);

        alterUser(exisingUser.userId, updatedUser, (err, updatedUserName) => {
          if (err) {
            sendFailure(res, err);
          } else {
            // Return the uptdated user
            sendSuccess(res, updatedUserName);
          }
        });
      });
    }
  });
});

// ------------------------------ DELETE -----------------------------

app.delete("/api/users/:id", (req, res) => {
  console.log(`webApi: entered DELETE ...`);

  const targetName = req.params.id.toString();
  exist(targetName, (err, existingUser) => {
    if (err) {
      sendFailure(res, err);
    } else {
      // delete
      deleteUser(existingUser.userId, targetName, err => {
        if (err) {
          sendFailure(res, err);
        } else {
          // Return deleted customer
          sendSuccess(res, targetName);
        }
      });
      // Return the deleted customer
    }
  });
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

console.log("web-api running ...");

//use the port number of the PORT env variable otherwise use 3000
const port = process.env.port || 3005;

//listen on port
console.log(`connecting to port: ${port} ...`);
app.listen(port, () => console.log(`listening on port ${port} ...`));
