var AWS = require("aws-sdk");

AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8000"
});

var dynamodb = new AWS.DynamoDB();

// Table variables
const tableName = "Users";
const userId = "userId";
const userName = "userName";
const indexUserName = "indexUserName";
// non key attributes
const userFirstName = "userFirstName";
const userLastName = "userLastName";
const userPassword = "userPassword";
const userCreateDate = "userCreateDate";

var params = {
  TableName: tableName,
  // Set the primary key of the table (can be a one part PK or a two part)
  KeySchema: [
    { AttributeName: userId, KeyType: "HASH" } // One part primary key
  ],
  // Additional attributes for the item
  AttributeDefinitions: [
    { AttributeName: userId, AttributeType: "S" },
    { AttributeName: userName, AttributeType: "S" }
  ],
  // Set up a secondary index for table. Used to query the 'cutomerName'
  GlobalSecondaryIndexes: [
    {
      IndexName: indexUserName,
      KeySchema: [
        {
          AttributeName: userName,
          KeyType: "HASH"
        }
        /*  {
                AttributeName: customerEmail,
                KeyType: "RANGE"
            } */
      ],
      Projection: {
        ProjectionType: "ALL"
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      }
    }
  ],
  ProvisionedThroughput: {
    // Ignored with downloadable dynamodb
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1
  }
};

dynamodb.createTable(params, function(err, data) {
  if (err) {
    console.error(
      "Unable to create table. Error JSON:",
      JSON.stringify(err, null, 2)
    );
  } else {
    console.log(
      "Created table. Table description JSON:",
      JSON.stringify(data, null, 2)
    );
  }
});
