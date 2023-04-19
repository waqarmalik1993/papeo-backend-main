exports.Activities = {
  addedAdmin: (activity) => {
    return {
      en: `Changed the name of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte den Titel der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
};
