import { ObjectID as objectId } from 'mongodb';

export default fields => node => {
  if ((Array.isArray(fields) ? fields : [fields]).includes(node.fieldName)) {
    Object.assign(node, {
      value: Array.isArray(node.value) ? node.value.map(objectId) : objectId(node.value),
    });
  }
};
