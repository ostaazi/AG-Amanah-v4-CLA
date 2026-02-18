export const isLockCommand = (command: string): boolean =>
  command === 'lockDevice' || command === 'lockscreenBlackout';

export const isLockEnableRequest = (command: string, payload: any): boolean => {
  if (command === 'lockDevice') {
    return payload === true;
  }
  if (command !== 'lockscreenBlackout') {
    return false;
  }
  if (typeof payload === 'boolean') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    if (typeof payload.enabled === 'boolean') {
      return payload.enabled;
    }
    if (payload.value && typeof payload.value === 'object' && typeof payload.value.enabled === 'boolean') {
      return payload.value.enabled;
    }
  }
  return !!payload;
};

export const shouldBlockLockActivation = (
  allLocksDisabled: boolean,
  command: string,
  payload: any
): boolean => allLocksDisabled && isLockCommand(command) && isLockEnableRequest(command, payload);
