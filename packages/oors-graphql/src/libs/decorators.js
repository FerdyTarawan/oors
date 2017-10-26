import Joi from 'joi';
import flow from 'lodash/flow';

export const withSchema = schema => resolver => (_, args, ctx, info) => {
  Joi.attempt(args, schema);
  return resolver(_, args, ctx, info);
};

export const withArgs = parser => resolver => (_, args, ctx, info) =>
  resolver(_, parser(args), ctx, info);

export const withContext = fn => resolver => (_, args, ctx, info) =>
  resolver(_, args, fn(ctx), info);

export const compose = (...decorators) => flow(decorators.reverse());

export const resolver = definition => (target, propr, descriptor) => {
  Object.assign(descriptor, {
    enumerable: true,
  });

  Object.assign(descriptor.value, {
    isResolver: true,
    definition,
  });

  return descriptor;
};
