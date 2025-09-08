module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ["babel-plugin-react-compiler", {
        // Enable React Compiler for performance optimization
        // Only compiles app code, not node_modules
        compilationMode: "infer"
      }]
    ],
  };
};