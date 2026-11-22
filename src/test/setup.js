import "@testing-library/jest-dom";
// ensure localStorage exists in jsdom (it does) and reset between tests
beforeEach(() => {
  localStorage.clear();
});