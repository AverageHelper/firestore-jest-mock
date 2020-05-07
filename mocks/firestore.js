const mockCollection = jest.fn();
const mockCollectionGroup = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockBatch = jest.fn();
const mockGet = jest.fn();
const mockGetAll = jest.fn();
const mockUpdate = jest.fn();
const mockAdd = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockStartAfter = jest.fn();
const mockStartAt = jest.fn();

const mockArrayRemoveFieldValue = jest.fn();
const mockArrayUnionFieldValue = jest.fn();
const mockDeleteFieldValue = jest.fn();
const mockIncrementFieldValue = jest.fn();
const mockServerTimestampFieldValue = jest.fn();

const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();

function buildDocFromHash(hash = {}) {
  return {
    exists: !!hash || false,
    id: hash.id || 'abc123',
    data() {
      const copy = { ...hash };
      delete copy.id;
      delete copy._collections;
      return copy;
    },
  };
}

function buildQuerySnapShot(requestedRecords) {
  const multipleRecords = requestedRecords.filter(rec => !!rec);
  const docs = multipleRecords.map(buildDocFromHash);

  return {
    empty: multipleRecords.length < 1,
    size: multipleRecords.length,
    docs,
    forEach(callback) {
      return docs.forEach(callback);
    },
  };
}

/*
 * ============
 *  Firestore
 * ============
 */

class FakeFirestore {
  constructor(stubbedDatabase = {}) {
    this.database = stubbedDatabase;
  }

  batch() {
    mockBatch(...arguments);
    return {
      delete() {
        mockBatchDelete(...arguments);
      },
      set() {
        mockBatchSet(...arguments);
      },
      update() {
        mockBatchUpdate(...arguments);
      },
      commit() {
        mockBatchCommit(...arguments);
        return Promise.resolve();
      },
    };
  }

  collection(collectionName) {
    mockCollection(...arguments);
    return new FakeFirestore.CollectionReference(collectionName, null, this);
  }

  collectionGroup(collectionName) {
    mockCollectionGroup(...arguments);
    return new FakeFirestore.Query(collectionName, this);
  }

  doc(path) {
    mockDoc(path);

    const pathArray = path.split('/');
    // Must be document-level, so even-numbered elements
    if (pathArray.length % 2) {
      throw new Error('The path array must be document-level');
    }

    let doc = null;
    for (let index = 0; index < pathArray.length; index++) {
      const collectionId = pathArray[index];
      const documentId = pathArray[index + 1];

      const collection = new FakeFirestore.CollectionReference(collectionId, doc, this);
      doc = new FakeFirestore.DocumentReference(documentId, collection);

      index++; // skip to next collection
    }
    return doc;
  }

  getAll() {
    mockGetAll(...arguments);
    return Promise.all([...arguments].map(r => r.get()));
  }
}

/*
 * ============
 *  Queries
 * ============
 */

FakeFirestore.Query = class {
  constructor(collectionName, firestore) {
    this.collectionName = collectionName;
    this.firestore = firestore;
  }

  get() {
    // Return all records in collections matching collectionName (use DFS)
    const requestedRecords = [];
    // requestedRecords.push(...this.firestore.database[this.collectionName]);

    const st = [this.firestore.database];
    // At each collection list node, get collection in collection list whose id
    // matches this.collectionName
    while (st.length > 0) {
      const subcollections = st.pop();
      const documents = subcollections[this.collectionName];
      if (documents && Array.isArray(documents)) {
        requestedRecords.push(...documents);
      }

      // For each collection in subcollections, get each document's _collections array
      // and push onto st.
      Object.values(subcollections).forEach(collection => {
        const documents = collection.filter(d => !!d._collections);
        st.push(...documents.map(d => d._collections));
      });
    }

    return Promise.resolve(buildQuerySnapShot(requestedRecords));
  }

  where() {
    return mockWhere(...arguments) || this;
  }

  limit() {
    return mockLimit(...arguments) || this;
  }

  orderBy() {
    return mockOrderBy(...arguments) || this;
  }

  startAfter() {
    return mockStartAfter(...arguments) || this;
  }

  startAt() {
    return mockStartAt(...arguments) || this;
  }
};

/*
 * ============
 *  Collection Reference
 * ============
 */

FakeFirestore.CollectionReference = class extends FakeFirestore.Query {
  constructor(id, parent, firestore) {
    super(id, firestore || parent.firestore);

    this.id = id;
    this.parent = parent;
    if (parent) {
      this.path = parent.path.concat(`/${id}`);
    } else {
      this.path = `database/${id}`;
    }
  }

  add(object) {
    mockAdd(...arguments);
    return Promise.resolve(buildDocFromHash(object));
  }

  doc(id) {
    mockDoc(id);
    return new FakeFirestore.DocumentReference(id, this, this.firestore);
  }

  /**
   * @function records
   * A private method, meant mainly to be used by `get` and other internal objects to retrieve
   * the list of database records referenced by this CollectionReference.
   * @returns {Object[]} An array of mocked document records.
   */
  records() {
    const pathArray = this.path.split('/');

    pathArray.shift(); // drop 'database'; it's always first
    let requestedRecords = this.firestore.database[pathArray.shift()];
    if (pathArray.length === 0) {
      return requestedRecords || [];
    }

    // Since we're a collection, we can assume that pathArray.length % 2 is always 0

    for (let index = 0; index < pathArray.length; index += 2) {
      const documentId = pathArray[index];
      const collectionId = pathArray[index + 1];

      if (!requestedRecords) {
        return [];
      }
      const document = requestedRecords.find(record => record.id === documentId);
      if (!document || !document._collections) {
        return [];
      }

      requestedRecords = document._collections[collectionId] || [];
      if (requestedRecords.length === 0) {
        return [];
      }

      // +2 skips to next collection
    }

    return requestedRecords;
  }

  get() {
    mockGet(...arguments);
    return Promise.resolve(buildQuerySnapShot(this.records()));
  }

  isEqual(other) {
    return (
      other instanceof FakeFirestore.CollectionReference &&
      other.firestore === this.firestore &&
      other.path === this.path
    );
  }
};

/*
 * ============
 *  Document Reference
 * ============
 */

FakeFirestore.DocumentReference = class {
  constructor(id, parent) {
    this.id = id;
    this.parent = parent;
    this.firestore = parent.firestore;
    this.path = parent.path.concat(`/${id}`);
  }

  collection(collectionName) {
    mockCollection(...arguments);
    return new FakeFirestore.CollectionReference(collectionName, this);
  }

  delete() {
    mockDelete(...arguments);
    return Promise.resolve();
  }

  get() {
    mockGet(...arguments);
    const pathArray = this.path.split('/');

    pathArray.shift(); // drop 'database'; it's always first
    let requestedRecords = this.firestore.database[pathArray.shift()];
    let document = null;
    if (requestedRecords) {
      const documentId = pathArray.shift();
      document = requestedRecords.find(record => record.id === documentId);
    } else {
      return Promise.resolve({ exists: false, id: this.id });
    }

    for (let index = 0; index < pathArray.length; index += 2) {
      const collectionId = pathArray[index];
      const documentId = pathArray[index + 1];

      if (!document || !document._collections) {
        return Promise.resolve({ exists: false, id: this.id });
      }
      requestedRecords = document._collections[collectionId] || [];
      if (requestedRecords.length === 0) {
        return Promise.resolve({ exists: false, id: this.id });
      }

      document = requestedRecords.find(record => record.id === documentId);
      if (!document) {
        return Promise.resolve({ exists: false, id: this.id });
      }

      // +2 skips to next document
    }

    if (document) {
      return Promise.resolve(buildDocFromHash(document));
    }
    return Promise.resolve({ exists: false, id: this.id });
  }

  update(object) {
    mockUpdate(...arguments);
    return Promise.resolve(buildDocFromHash(object));
  }

  set(object) {
    mockSet(...arguments);
    return Promise.resolve(buildDocFromHash(object));
  }

  isEqual(other) {
    return (
      other instanceof FakeFirestore.DocumentReference &&
      other.firestore === this.firestore &&
      other.path === this.path
    );
  }
};

/*
 * ============
 *  FieldValue
 * ============
 */

FakeFirestore.FieldValue = class {
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }

  isEqual(other) {
    return (
      other instanceof FakeFirestore.FieldValue &&
      other.type === this.type &&
      other.value === this.value
    );
  }

  transform(value) {
    switch (this.type) {
      case 'arrayUnion':
        if (Array.isArray(value)) {
          return value.concat(this.value.filter(v => !value.includes(v)));
        } else {
          return this.value;
        }
      case 'arrayRemove':
        if (Array.isArray(value)) {
          return value.filter(v => !this.value.includes(v));
        } else {
          return value;
        }
      case 'increment': {
        const amount = Number(this.value);
        if (typeof value === 'number') {
          return value + amount;
        } else {
          return amount;
        }
      }
      case 'serverTimestamp': {
        return FakeFirestore.Timestamp.now();
      }
      case 'delete':
        return undefined;
    }
  }

  static arrayUnion(elements = []) {
    mockArrayUnionFieldValue(...arguments);
    if (!Array.isArray(elements)) {
      elements = [elements];
    }
    return new FakeFirestore.FieldValue('arrayUnion', elements);
  }

  static arrayRemove(elements) {
    mockArrayRemoveFieldValue(...arguments);
    if (!Array.isArray(elements)) {
      elements = [elements];
    }
    return new FakeFirestore.FieldValue('arrayRemove', elements);
  }

  static increment(amount = 1) {
    mockIncrementFieldValue(...arguments);
    return new FakeFirestore.FieldValue('increment', amount);
  }

  static serverTimestamp() {
    mockServerTimestampFieldValue(...arguments);
    return new FakeFirestore.FieldValue('serverTimestamp');
  }

  static delete() {
    mockDeleteFieldValue(...arguments);
    return new FakeFirestore.FieldValue('delete');
  }
};

/*
 * ============
 *  Timestamp
 * ============
 */

FakeFirestore.Timestamp = class {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now() {
    const now = Date.now();
    return new FakeFirestore.Timestamp(now / 1000, 0);
  }

  isEqual(other) {
    return (
      other instanceof FakeFirestore.FieldValue.Timestamp &&
      other.seconds === this.seconds &&
      other.nanoseconds === this.nanoseconds
    );
  }
};

module.exports = {
  FakeFirestore,
  mockAdd,
  mockBatch,
  mockCollection,
  mockCollectionGroup,
  mockDelete,
  mockDoc,
  mockGet,
  mockGetAll,
  mockOrderBy,
  mockLimit,
  mockStartAfter,
  mockStartAt,
  mockSet,
  mockUpdate,
  mockWhere,
  mockArrayRemoveFieldValue,
  mockArrayUnionFieldValue,
  mockDeleteFieldValue,
  mockIncrementFieldValue,
  mockServerTimestampFieldValue,
  mockBatchDelete,
  mockBatchCommit,
  mockBatchUpdate,
  mockBatchSet,
};
