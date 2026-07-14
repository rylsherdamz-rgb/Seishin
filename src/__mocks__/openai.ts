const OpenAI = jest.fn(() => ({
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
}));

export default OpenAI;
export { OpenAI };
