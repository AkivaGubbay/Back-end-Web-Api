const {
  TABLE_NAME,
  USER_ID,
  USER_NAME,
  INDEX_USER_NAME,
  USER_FIRST_NAME,
  USER_LAST_NAME,
  USER_PASSWORD,
  USER_CREATE_DATE
} = require("./Constants");

// Used for dynamodb communication
const AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

function makeError(err, msg) {
  // Used in both
  var e = new Error(msg);
  e.code = err;
  return e;
}

// Return user without id and password
function secureUserInfo(user) {
  delete user.userId;
  delete user.userPassword;
  // Not sure if to return the createDate
  delete user.userCreateDate;
  return user;
}

module.exports.makeError = makeError; // Goal: this should only be in the DAL

// ------------------- GET helper functions -------------------

// Scan the whole table without a 'filterExpression'
module.exports.getAllUsers = callback => {
  const docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: TABLE_NAME,
    ProjectionExpression: "#name",
    ExpressionAttributeNames: {
      "#name": USER_NAME
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
};

module.exports.getUser = (requestName, callback) => {
  const docClient = new AWS.DynamoDB.DocumentClient();
  console.log("entering dal looking for ", requestName);
  var params = {
    TableName: TABLE_NAME,
    IndexName: INDEX_USER_NAME,
    KeyConditionExpression: "#name = :reqName",
    ExpressionAttributeNames: {
      "#name": USER_NAME
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
        let retrievedUser = { ...data.Items[0] };
        const secureUser = secureUserInfo(retrievedUser);
        console.log("the returning user:", secureUser);
        callback(null, secureUser);
      }
    }
  });
};

// ------------------- POST helper functions -------------------

module.exports.addUser = (user, callback) => {
  const docClient = new AWS.DynamoDB.DocumentClient();

  console.log("adding user:", user);

  var params = {
    TableName: TABLE_NAME,
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
};

module.exports.exist = (targetName, callback) => {
  const docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: TABLE_NAME,
    IndexName: INDEX_USER_NAME,
    KeyConditionExpression: "#name = :trgName",
    ExpressionAttributeNames: {
      "#name": USER_NAME
    },
    ExpressionAttributeValues: {
      ":trgName": targetName
    }
  };

  docClient.query(params, (err, data) => {
    let serverError = null;
    let existingUser = null;
    if (err) {
      // Query faild
      serverError = new makeError(
        500,
        "Unable to query. Error" + JSON.stringify(err, null, 2)
      );
    } else if (data.Items.length != 0) {
      // Return user id and password
      existingUser = {
        userId: data.Items[0].userId,
        userName: data.Items[0].userName,
        userPassword: data.Items[0].userPassword
      };
    }
    callback(serverError, existingUser);
  });
};

// ------------------- PUT helper functions -------------------

module.exports.alterUser = (targetId, updatedUser, callback) => {
  const docClient = new AWS.DynamoDB.DocumentClient();
  console.log("updated user: ", updatedUser);
  var params = {
    TableName: TABLE_NAME,
    Key: {
      userId: targetId
    },
    UpdateExpression:
      "set #oldName = :newName, #fn = :fn, #ln = :ln, #pwd = :pwd",
    ExpressionAttributeNames: {
      "#oldName": USER_NAME,
      "#fn": USER_FIRST_NAME,
      "#ln": USER_LAST_NAME,
      "#pwd": USER_PASSWORD
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
      const secureUser = secureUserInfo(retrievedUser);
      console.log("the returning user:", secureUser);
      callback(null, secureUser);
    }
  });
};

// ------------------ DELETE helper functions ------------------

module.exports.deleteUser = (targetId, targetName, callback) => {
  const docClient = new AWS.DynamoDB.DocumentClient();

  var params = {
    TableName: TABLE_NAME,
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
};

/* module.exports.alreadyExists = (requestName, callback) => {
  const docClient = new AWS.DynamoDB.DocumentClient();

  console.log(`checking if user name:${requestName} already exists`);

  var params = {
    TableName: TABLE_NAME,
    IndexName: INDEX_USER_NAME,
    KeyConditionExpression: "#name = :reqName",
    ExpressionAttributeNames: {
      "#name": USER_NAME
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
        callback(null);
      }
    }
  });
}; */
