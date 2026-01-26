export const createDoneStates = () => ({
  done: {
    tags: ['ready', 'done'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
    },
  },
});
