const { mockFirebase, FakeFirestore } = require('firestore-jest-mock');
const {
  mockRunTransaction,
  mockDelete,
  mockUpdate,
  mockSet,
  mockGet,
} = require('firestore-jest-mock/mocks/firestore');

describe('Transactions', () => {
  mockFirebase({
    database: {},
  });
  const firebase = require('firebase');
  firebase.initializeApp({
    apiKey: '### FIREBASE API KEY ###',
    authDomain: '### FIREBASE AUTH DOMAIN ###',
    projectId: '### CLOUD FIRESTORE PROJECT ID ###',
  });
  const db = firebase.firestore();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('it returns a Promise', () => {
    const result = db.runTransaction(async () => {});

    expect(result).toBeInstanceOf(Promise);
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  test('it provides a Transaction object', () => {
    const runner = jest.fn().mockReturnValue(Promise.resolve());
    const result = db.runTransaction(runner);

    expect(result).toBeInstanceOf(Promise);
    expect(runner).toHaveBeenCalled();
    expect(runner.mock.calls[0][0]).toBeInstanceOf(FakeFirestore.Transaction);
  });

  test('getMock is accessible', async () => {
    expect.assertions(6);
    expect(FakeFirestore.Transaction.getMock).not.toHaveBeenCalled();
    const ref = db.collection('some').doc('body');

    await db.runTransaction(async transaction => {
      const result = transaction.get(ref);
      expect(result).toBeInstanceOf(Promise);
      const doc = await result;

      expect(mockGet).toHaveBeenCalled();
      expect(doc).toHaveProperty('id', 'body');
      expect(doc).toHaveProperty('exists', false);
    });
    expect(FakeFirestore.Transaction.getMock).toHaveBeenCalled();
  });

  test('setMock is accessible', async () => {
    expect.assertions(4);
    expect(FakeFirestore.Transaction.setMock).not.toHaveBeenCalled();
    const ref = db.collection('some').doc('body');

    await db.runTransaction(async transaction => {
      const newData = { foo: 'bar' };
      const options = { merge: true };
      const result = transaction.set(ref, newData, options);

      expect(result).toBeInstanceOf(FakeFirestore.Transaction);
      expect(mockSet).toHaveBeenCalledWith(newData, options);
    });
    expect(FakeFirestore.Transaction.setMock).toHaveBeenCalled();
  });

  test('updateMock is accessible', async () => {
    expect.assertions(4);
    expect(FakeFirestore.Transaction.updateMock).not.toHaveBeenCalled();
    const ref = db.collection('some').doc('body');

    await db.runTransaction(async transaction => {
      const newData = { foo: 'bar' };
      const result = transaction.update(ref, newData);

      expect(result).toBeInstanceOf(FakeFirestore.Transaction);
      expect(mockUpdate).toHaveBeenCalledWith(newData);
    });
    expect(FakeFirestore.Transaction.updateMock).toHaveBeenCalled();
  });

  test('deleteMock is accessible', async () => {
    expect.assertions(4);
    expect(FakeFirestore.Transaction.deleteMock).not.toHaveBeenCalled();
    const ref = db.collection('some').doc('body');

    await db.runTransaction(async transaction => {
      const result = transaction.delete(ref);

      expect(result).toBeInstanceOf(FakeFirestore.Transaction);
      expect(mockDelete).toHaveBeenCalled();
    });
    expect(FakeFirestore.Transaction.deleteMock).toHaveBeenCalled();
  });
});
