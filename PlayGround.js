const A = {
  _b: "b",
  _c: "c"
};

const B = {
  _c: "cc",
  _d: "dd"
};

const ob = Object.assign({}, A, B);

console.log("ob: ", ob);
console.log("B: ", B);
