//import { socket, systemState } from '../../front-end.js';
import {
  socket,
  systemState,
} from '../../initialization/global-variables/global-variables.js';

export const resyncActions = () => {
  const data = {
    roomId: systemState.roomId,
    actionData: systemState.selfActionData,
  };
  socket.emit('catchUpActions', data);
};
