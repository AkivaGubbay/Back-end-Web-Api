// Used for dynamodb communication
const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

// db table attributes
// const userTable = {};
const tableName = "Users";
const userId = "userId";
const userName = "userName";
const indexUserName = "indexUserName";
// non key attributes
const userFirstName = "userFirstName";
const userLastName = "userLastName";
const userPassword = "userPassword";
const userCreateDate = "userCreateDate";

function makeError(err, msg) {
  // Used in both
  var e = new Error(msg);
  e.code = err;
  return e;
}

module.exports.makeError = makeError; // Goal: this should only be in the DAL

// ------------------- GET helper functions -------------------

// Scan the whole table without a 'filterExpression'
function getAllUsers(callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: tableName,
    ProjectionExpression: "#name",
    ExpressionAttributeNames: {
      "#name": userName
    }
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      // Scan failed
      var serverError = new makeError(
        500,
        "Unable to scan. Error" + JSON.stringify(err, null, 2)
      );
      callback(serverError, null);
    } else {
      // Putting all users into an array
      var users = [];
      console.log("Scan succeeded.");
      data.Items.forEach(function(scannedUser) {
        users.push(scannedUser);
      });
      // continue scanning if we have more customers, because
      // scan can retrieve a maximum of 1MB of data
      if (typeof data.LastEvaluatedKey != "undefined") {
        console.log("Scanning for more...");
        params.ExclusiveStartKey = data.LastEvaluatedKey;
        docClient.scan(params, onScan);
      }
      callback(null, users);
    }
  });
}

function getUser(requestName, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();
  console.log("entering dal looking for ", requestName);
  var params = {
    TableName: tableName,
    IndexName: indexUserName,
    KeyConditionExpression: "#name = :reqName",
    ExpressionAttributeNames: {
      "#name": userName
    },
    ExpressionAttributeValues: {
      ":reqName": requestName
    }
  };

  docClient.query(params, (err, data) => {
    if (err) {
      // Query faild
      var serverError = new makeError(
        500,
        "Unable to query. Error" + JSON.stringify(err, null, 2)
      );
      callback(serverError, null);
    } else {
      if (data.Items.length < 1) {
        // No user with requested name
        callback(
          new makeError(404, `No customer by the name: ${requestName}`, null)
        );
      } else {
        // Return user without id and password
        let retrievedUser = { ...data.Items[0] };
        delete retrievedUser.userId;
        delete retrievedUser.userPassword;
        console.log("returning user:", retrievedUser);
        callback(null, retrievedUser);
      }
    }
  });
}

// ------------------- POST helper functions -------------------

function addUser(user, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();

  console.log("adding user:", user);

  var params = {
    TableName: tableName,
    Item: user
  };

  docClient.put(params, function(err, data) {
    if (err) {
      // Faild do add customer
      var serverError = new makeError(
        500,
        `Unable to add user: ${user.name}. Error` + JSON.stringify(err, null, 2)
      );
      callback(serverError);
      //console.error("Unable to add customer", customer.name, ". Error JSON:", JSON.stringify(err, null, 2));
    } else {
      console.log("PutItem succeeded:", user.userName);
      callback(null);
    }
  });
}

function alreadyExists(requestName, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();

  console.log(`checking if user name:${requestName} already exists`);

  var params = {
    TableName: tableName,
    IndexName: indexUserName,
    KeyConditionExpression: "#name = :reqName",
    ExpressionAttributeNames: {
      "#name": userName
    },
    ExpressionAttributeValues: {
      ":reqName": requestName
    }
  };

  docClient.query(params, (err, data) => {
    if (err) {
      // Query faild
      var serverError = new makeError(
        500,
        "Unable to query. Error" + JSON.stringify(err, null, 2)
      );
      callback(serverError);
    } else {
      if (data.Items.length != 0) {
        // A customer with the requested name already exists
        var notUniqueNameError = new makeError(
          400,
          `user name: ${requestName} has already been used.`
        );
        callback(notUniqueNameError);
      }
      // The requested customer name is unique
      else {
        console.log("ok4");
        callback(null);
      }
    }
  });
}

// ------------------- PUT helper functions -------------------

function exist(targetName, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: tableName,
    IndexName: indexUserName,
    KeyConditionExpression: "#name = :trgName",
    ExpressionAttributeNames: {
      "#name": userName
    },
    ExpressionAttributeValues: {
      ":trgName": targetName
    }
  };

  docClient.query(params, (err, data) => {
    if (err) {
      // Query faild
      var serverError = new makeError(
        500,
        "Unable to query. Error" + JSON.stringify(err, null, 2)
      );
      callback(serverError, null);
    } else {
      if (data.Items.length == 0) {
        // No such customer
        var noUserError = new makeError(
          404,
          `user name: ${targetName} does NOT exist.`
        );
        callback(noUserError, null);
      }
      // Return user id
      else {
        callback(null, data.Items[0].userId);
      }
    }
  });
}

function alterUser(targetId, updatedUser, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();
  console.log("updated user: ", updatedUser);
  var params = {
    TableName: tableName,
    Key: {
      userId: targetId
    },
    UpdateExpression:
      "set #oldName = :newName, #fn = :fn, #ln = :ln, #pwd = :pwd",
    ExpressionAttributeNames: {
      "#oldName": userName,
      "#fn": userFirstName,
      "#ln": userLastName,
      "#pwd": userPassword
    },
    ExpressionAttributeValues: {
      ":newName": updatedUser.userName,
      ":fn": updatedUser.userFirstName,
      ":ln": updatedUser.userLastName,
      ":pwd": updatedUser.userPassword
    },
    ReturnValues: "UPDATED_NEW"
  };
  docClient.update(params, function(err, data) {
    if (err) {
      var serverError = new makeError(
        500,
        "Unable to update customer. Error" + JSON.stringify(err, null, 2)
      );
      callback(serverError, null);
    } else {
      // Return user without id and password
      console.log("data.Attributes", data.Attributes);
      let retrievedUser = { ...data.Attributes };
      delete retrievedUser.userId;
      delete retrievedUser.userPassword;
      console.log("retrievedUser", retrievedUser);
      callback(null, retrievedUser);
    }
  });
}

// ------------------ DELETE helper functions ------------------

function deleteUser(targetId, targetName, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: tableName,
    Key: {
      userId: targetId
    }
  };

  docClient.delete(params, function(err, data) {
    if (err) {
      var serverError = new makeError(
        500,
        `Unable to delete customer: ${targetName}. Error` +
          JSON.stringify(err, null, 2)
      );
      callback(serverError);
    } else {
      callback(null);
    }
  });
}

// ~~~~~~~ Exporting DAL functions ~~~~~~~

module.exports.getAllUsers = getAllUsers;
module.exports.getUser = getUser;

module.exports.addUser = addUser;
module.exports.alreadyExists = alreadyExists;

module.exports.exist = exist;
module.exports.alterUser = alterUser;

module.exports.deleteUser = deleteUser;

module.exports.userId = userId;
module.exports.userCreateDate = userCreateDate;
