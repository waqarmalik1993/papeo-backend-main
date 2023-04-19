import axios from "axios";
const mock = {
  name: "Bunkerrave 6",
  description: "No Photos ❌📷",
  tags: ["bunkerrave", "techno"],
  status: "published",
  type: "private",
  privacyLevel: "closed",
  location: {
    coordinates: [10.1, 12.34],
  },
  capacity: 1,
  startDate: "2021-07-05T20:48:00.000Z",
};

const data = [
  {
    date: "2021-07-06T20:48:00.000Z",
    coords: [52.546257, 13.284575],
    location: "Jungfernheide",
  },
  {
    date: "2021-07-07T20:48:00.000Z",
    coords: [52.527266, 13.432098],
    location: "Volkspark Fhain",
  },
  {
    date: "2021-07-08T20:48:00.000Z",
    coords: [52.475419, 13.400378],
    location: "Tempelhofer Feld",
  },
  {
    date: "2021-07-09T20:48:00.000Z",
    coords: [52.434716, 13.289428],
    location: "Lichterfelde West",
  },
  {
    date: "2021-07-10T20:48:00.000Z",
    coords: [51.920901, 4.544989],
    location: "Rotterdam",
  },
  {
    date: "2021-07-10T20:48:00.000Z",
    coords: [52.832028, 13.794994],
    location: "Eberswalde",
  },
];

const mockedParties = data.map((l) => {
  const party = {
    name: "Party " + l.location,
    location: {
      coordinates: l.coords,
    },
    startDate: l.date,
    capacity: 1,
  };
  return party;
});
async function run() {
  mockedParties.forEach(async (party) => {
    axios
      .post("http://localhost:3000/parties", party, {
        headers: {
          Authorization:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MGRjYzNhNmNlMGY0NzA5MDdiYzRkYjciLCJpYXQiOjE2MjUwODA3NDM4NjZ9.D0JrVqlLqHnkj9HmAWWO7sLM5gBvvp9CuZM-tFLL_bQ",
        },
      })
      .then((res) => {
        console.log("RESPONSE RECEIVED: ", res);
      })
      .catch((err) => {
        console.log("AXIOS ERROR: ", err);
      });
  });
}
run();
