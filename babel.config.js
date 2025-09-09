module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { reanimated: false }],
      "nativewind/babel",
    ],
    plugins: [
      ["babel-plugin-react-compiler", { compilationMode: "infer" }],
    ],
  };
};