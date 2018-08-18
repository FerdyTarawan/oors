import { createCRUDResolvers } from '../../../../../../../../packages/oors-mongodb/build/libs/graphql';
import { compose } from '../../../../../../../../packages/oors-graphql/build/decorators';
import {
  validateCreateCommentInput,
  parseCommentInput,
  validateCreateCommentReferences,
} from './decorators';

const resolvers = createCRUDResolvers({
  getRepository: 'blogComment',
  getLoaders: ({ loaders }) => loaders.blog.comments,
  canUpdate: (user, item) => user._id.toString() === item.createdBy.toString(),
  canDelete: (user, item) => user._id.toString() === item.createdBy.toString(),
});

export default {
  BlogComment: {
    parent: (comment, args, { loaders }) => comment.parentId ? loaders.blog.comments.findById.load(comment.parentId) : null,
    children: (comment, args, { loaders }) => loaders.blog.comments.findMany.load({
      query: {
        parentId: comment.id,
      },
    }),
    post: (comment, args, { loaders }) => loaders.blog.posts.findById.load(comment.postId),
    author: (comment, args, { loaders }) => loaders.users.findById.load(comment.createdBy),
  },
  Mutation: {
    createOneBlogComment: compose(
      validateCreateCommentInput,
      parseCommentInput,
      validateCreateCommentReferences,
    )(resolvers.createOne),
    updateOneBlogComment: compose(parseCommentInput)(resolvers.updateOne),
  },
};
