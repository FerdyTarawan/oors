import ValidationError from 'oors/build/errors/ValidationError';
import Store from './Store';
import AggregationPipeline from './AggregationPipeline';

class Repository extends Store {
  static getCollectionName() {
    return this.collectionName || this.name.substr(0, this.name.indexOf('Repository'));
  }

  constructor({ collection, schema, collectionName } = {}) {
    super(collection);
    this.schema = schema || this.constructor.schema;
    this.collectionName = collectionName || this.constructor.getCollectionName();
    this.relations = {};
  }

  // eslint-disable-next-line
  configure({ getRepository }) {}

  validate = () => true;

  // eslint-disable-next-line class-methods-use-this
  getRepository() {
    throw new Error('Not available! You need to bind the repository first.');
  }

  async parse(data) {
    if (!this.validate(data)) {
      throw new ValidationError(this.validate.errors);
    }

    return data;
  }

  addRelation = (name, options) => {
    const { repositoryName, collectionName, type, localField, foreignField } = options;
    const repository = options.repository || this.getRepository(repositoryName);

    this.relations[name] = {
      repositoryName,
      repository,
      collectionName: collectionName || repository.collectionName,
      type,
      localField,
      foreignField,
    };

    return this;
  };

  relationToLookup(name, options = {}) {
    const { collectionName, localField, foreignField, as } = this.relations[name];

    return {
      from: collectionName,
      localField,
      foreignField,
      as: as || name,
      ...options,
    };
  }

  getFields = () => Object.keys(this.schema.properties);

  runBulkOperation = async ({ ordered = false } = {}, callback) => {
    const bulk = this.collection[`initialize${ordered ? 'Ordered' : 'Unordered'}BulkOp`]();
    await callback(bulk);
    return bulk.execute();
  };

  aggregate = (callback, options = {}) => {
    const result = callback(this.createPipeline());
    const pipeline = Array.isArray(result) ? result : result.toArray();
    return this.collection.aggregate(pipeline, options).toArray();
  };

  createPipeline = () => new AggregationPipeline(this);
}

export default Repository;