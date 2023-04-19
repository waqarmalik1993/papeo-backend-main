const User = require("../services/users/usersService.js");
const auth = require("../middleware/auth.js").auth;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const ReferralTree = require("../services/referralTree/referralTreeService");
const { BadRequest, Forbidden, NotFound } = require("@feathersjs/errors");

module.exports = async (app) => {
  const html = (childrenJson) => `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">

    <title>Collapsible Tree Example</title>

    <style>

	.node circle {
	  fill: #fff;
	  stroke: steelblue;
	  stroke-width: 3px;
	}

	.node text { font: 12px sans-serif; y: 20 }

	.link {
	  fill: none;
	  stroke: #ccc;
	  stroke-width: 2px;
	}
	
    </style>

  </head>

  <body>

<!-- load the d3.js library -->	
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js"></script>
	
<script>

var treeData = [
    {
        "name": "NO CODE",
        "parent": "null",
        "value":5,
        "type": "black",
        "level": "blue",
        "children": ${childrenJson}
      },
  
];

// ************** Generate the tree diagram	 *****************
var margin = {top: 20, right: 120, bottom: 20, left: 120},
	width = 30000 - margin.right - margin.left,
	height = 5000 - margin.top - margin.bottom;
	
var i = 0;

var tree = d3.layout.tree()
	.size([height, width]);

var diagonal = d3.svg.diagonal()
	.projection(function(d) { return [d.y, d.x]; });

var svg = d3.select("body").append("svg")
	.attr("width", width + margin.right + margin.left)
	.attr("height", height + margin.top + margin.bottom)
  .append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

root = treeData[0];
  
update(root);

function update(source) {

  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse(),
	  links = tree.links(nodes);

  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 180; });

  // Declare the nodes…
  var node = svg.selectAll("g.node")
	  .data(nodes, function(d) { return d.id || (d.id = ++i); });

  // Enter the nodes.
  var nodeEnter = node.enter().append("g")
	  .attr("class", "node")
	  .attr("transform", function(d) { 
		  return "translate(" + d.y + "," + d.x + ")"; });

  nodeEnter.append("circle")
	  .attr("r", function(d) { return d.value; })
	  .style("stroke", function(d) { return d.type; })
	  .style("fill", function(d) { return d.level; });

  nodeEnter.append("text")
	  .attr("x", function(d) { 
		  return 0 })
	  .attr("y", function(d) { 
		  return 17
      })
	  //.attr("dy", ".35em")
	  .attr("text-anchor", function(d) { 
		  return "middle"; })
	  .text(function(d) { return d.name; })
	  .style("fill-opacity", 1);

  // Declare the links…
  var link = svg.selectAll("path.link")
	  .data(links, function(d) { return d.target.id; });

  // Enter the links.
  link.enter().insert("path", "g")
	  .attr("class", "link")
  	  .style("stroke", function(d) { return d.target.level; })
	  .attr("d", diagonal);

}

</script>
	
  </body>
</html>
  `;
  app.get(
    "/referraltree/visual",
    // basic auth
    /*(req, res, next) => {
      // -----------------------------------------------------------------------
      // authentication middleware

      const auth = { login: "yourlogin", password: "yourpassword" }; // change this

      // parse login and password from headers
      const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
      const [login, password] = Buffer.from(b64auth, "base64")
        .toString()
        .split(":");

      // Verify login and password are set and correct
      if (
        login &&
        password &&
        login === "nico" &&
        password === "xPneebGFk-TvoN@CKoMnk4Bd"
      ) {
        // Access granted...
        return next();
      }

      // Access denied...
      res.set("WWW-Authenticate", "Basic realm=\"Papeo\""); // change this
      res.status(401).send("Authentication required."); // custom message

      // -----------------------------------------------------------------------
    },*/
    async (req, res, next) => {
      try {
        if (req.query.key !== "4c6f7fb3-a084-4915-b821-c212b5bae7ac") {
          throw new Forbidden();
        }
        const referralTree = await ReferralTree.MODEL.find({}).lean();
        const referralTreeConverted = referralTree.map((entry) => {
          return {
            name: `${entry.userData.username} M:${entry.memberCount}`,
            parent: entry.parent,
            userId: entry._id.toString(),
            parentId: entry.parent === null ? null : entry.parent.toString(),
            value: 5,
            type: "black",
            level: "blue",
          };
        });
        //console.log(referralTreeConverted);
        res.setHeader("content-type", "text/html");
        res.setHeader(
          "Content-Security-Policy",
          "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
        );

        let roots = referralTreeConverted.filter((entry) => {
          return entry.parent === null;
        });

        const getChildren = (x) => {
          const findres = referralTreeConverted.filter(
            (y) => y.parentId === x.userId
          );
          //console.log(findres);
          if (!Array.isArray(findres)) return { ...x, children: [] };
          return {
            ...x,
            children: findres ? findres.map(getChildren) : [],
          };
        };
        const children = roots.map(getChildren);
        res.send(html(JSON.stringify(children)));
      } catch (e) {
        next(e);
      }
    }
  );
  app.get("/referraltree", auth, async (req, res, next) => {
    try {
      const result = await ReferralTree.find({ query: req.query });
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/referraltree/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const result = await ReferralTree.get(userId);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/referraltree/parent/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const referredUser = await ReferralTree.get(userId);
      if (!referredUser || !referredUser.parent) throw new NotFound();
      res.send(await ReferralTree.get(referredUser.parent));
    } catch (e) {
      next(e);
    }
  });
};
