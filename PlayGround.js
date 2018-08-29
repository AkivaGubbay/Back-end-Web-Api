function foo(name) {
  console.log("foo ...", name);
}

function bar(name) {
  console.log("bar ...", name);
}

module.exports.foo = foo;
module.exports.bar = bar;

//let date = require("date-and-time");
let now = new Date();
//date.format(now, "YYYY/MM/DD HH:mm:ss");
console.log(`my date: |${String(now)}|`);

console.log("type of data: ", typeof String(now));
