exports.transformComments = (comments) => {
  let parentCommentArray = [];
  let subCommentArray = [];

  comments.forEach(comment => {
    if (comment.parentComment) {
      subCommentArray.push(comment);
    } else {
      comment.comments = [];
      parentCommentArray.push(comment);
    }
  });

  console.log(parentCommentArray.length)
  console.log(subCommentArray.length)

  subCommentArray.forEach(comment => {
    let foundParentComment = parentCommentArray.find((element, index) => {
      if(element._id.toString() == comment.parentComment.toString()) return {
        comment: element,
        index
      };
    });
    if(foundParentComment) {
      transformedComment = foundParentComment.comments.push(comment);
      parentCommentArray[foundParentComment.index] = transformedComment;
    }
  });
  return parentCommentArray;
};
