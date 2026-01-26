export const createIdleStates = () => ({
  idle: {
    tags: ['idle'],
    on: {
      START: { target: 'starting', actions: 'setStartInput' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
      CONFIRM: { target: 'confirming', actions: 'setConfirmInput' },
      CANCEL: { target: 'cancelling', actions: 'setCancelInput' },
    },
  },
});
