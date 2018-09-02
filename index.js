const Joi = require("joi");
const uuidv1 = require("uuid/v1");
const express = require("express"); //returns a function
var cors = require("cors");
const app = express();

// Fixes error: CORS
app.use(cors());

// Enables json in a request body
app.use(express.json());

const {
  USER_ID,
  USER_CREATE_DATE /* TABLE_NAME, USER_NAME, INDEX_USER_NAME, USER_FIRST_NAME, USER_LAST_NAME, USER_PASSWORD */
} = require("./Constants");

// Importing DAL functions
const {
  getAllUsers,
  getUser,
  addUser,
  alreadyExists,
  exist,
  alterUser,
  deleteUser,
  makeError // This shoule only be in the DAL!!!
} = require("./DAL");

// -------------------- HTTP Response functions -------------------

function sendSuccess(res, data) {
  // Used only in helper functions
  var output = JSON.stringify({ error: null, data: data }) + "\n";
  res.status(200).send(output);
}

function sendFailure(res, err) {
  // Used only in helper functions
  var output = JSON.stringify({ error: err.code, data: err.message }) + "\n";
  res.status(err.code).send(output);
}

// ------------------------------ Validation ------------------------------

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
    callback(new makeError(400, result.error.details[0].message));
  } else callback(null);
}

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

app.post("/api/users", (req, res) => {
  console.log(`webApi: entered POST ...`);

  validation(req, err => {
    if (err) {
      sendFailure(res, err);
      return;
    }

    // Check user name doesn't already exist
    alreadyExists(req.body.userName, err => {
      if (err) {
        sendFailure(res, err);
      } else {
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
  exist(targetName, (err, targetId) => {
    if (err) {
      sendFailure(res, err);
    } else {
      validation(req, err => {
        if (err) {
          sendFailure(res, err);
          return;
        }
        // Update requiered fields here
        const updatedUser = { ...req.body };

        console.log(`webApi: PUT - user: ${updatedUser.userName} ...`);

        alterUser(targetId, updatedUser, (err, updatedUserName) => {
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
  exist(targetName, (err, targetId) => {
    if (err) {
      sendFailure(res, err);
    } else {
      // delete
      deleteUser(targetId, targetName, err => {
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
