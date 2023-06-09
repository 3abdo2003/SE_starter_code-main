const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const {getSessionToken}=require('../../utils/session');
const nodemon = require("nodemon");
const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }
  console.log("hi",sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userid",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleid",
      "se_project.roles.id"
    )
   .first();

  console.log("user =>", user);
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  console.log("user =>", user)
  return user;
};  

module.exports = function (app) {
  // example
  app.get("/users", async function (req, res) {
    try {
       const user = await getUser(req);
      
      const users = await db.select('*').from("se_project.users")
        
      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
   
  });

  app.post("/api/v1/station", async (req, res) =>{

    try {
      const {id,stationname,stationtype,stationposition,stationstatus} = req.body;
      console.log(req.body);
      let newStation = {
    
        stationname,
        stationtype: "normal",
        stationposition : null,
        stationstatus: "new"
        
      };
  
     const addedStation = await db("se_project.stations").insert(newStation).returning("*");
     console.log(addedStation)
     return res.status(200).json(addedStation);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send(e.message);
    }

  });

  app.put("/api/v1/station/:stationId", async (req, res) =>{

    try {
      const {stationId} = req.params;
      const {stationname} = req.body;
      const updateStation = await db("se_project.stations")
      .where("id", stationId)
      .update({
        stationname: stationname,
      })
      .returning("*");
      if (isEmpty(updateStation)) {
        return res.status(400).send("station not exists");
      }
       return res.status(200).json("Station updated successfully")

    } catch (e) {

      console.log(e.message);
      return res.status(400).send("Could not update station");
    }

  });

  app.delete("/api/v1/station/:stationId", async (req, res) => {
    try {
      const { stationId } = req.params;
      const station = await db("se_project.stations").where("id", stationId).first();
      console.log("station:", station);
      if (!station) {
        return res.status(404).send("Station not found");
      }
      const { stationtype, stationposition } = station;
      if (stationtype === "normal") {
        if (stationposition === "start") {
          const newStart = await db.select("tostationid").from("se_project.routes").where("fromstationid", stationId);
          console.log("newStart:", newStart);
          await db("se_project.routes").where("fromstationid", stationId).del();
          await db("se_project.routes").insert(newStart.map((item) => ({ fromstationid: item.tostationid, tostationid: item.fromstationid, routename: `new_${item.tostationid}_${station.position}` })));
        } else if (stationposition === "end") {
          const newEnd = await db.select("fromstationid").from("se_project.routes").where("tostationid", stationId);
          console.log("newEnd:", newEnd);
          await db("se_project.routes").where("tostationid", stationId).del();
          await db("se_project.routes").insert(newEnd.map((item) => ({ fromstationid: item.fromstationid, tostationid: item.tostationid, routename: `new_${stationId}_${item.fromstationid}` })));
        } else if (stationposition === "middle") {
          const newStart = await db.select("tostationid").from("se_project.routes").where("fromstationid", stationId);
          const newEnd = await db.select("fromstationid").from("se_project.routes").where("tostationid", stationId);
          console.log("newStart:", newStart);
          console.log("newEnd:", newEnd);
          await db("se_project.routes").where("fromstationid", stationId).orWhere("tostationid", stationId).del();
          await db("se_project.routes").insert([
            ...newStart.map((item) => ({ fromstationid: item.tostationid, tostationid: item.fromstationid, routename: `new_${item.tostationid}_${station.position}` })),
            ...newEnd.map((item) => ({ fromstationid: item.fromstationid, tostationid: item.tostationid, routename: `new_${stationId}_${item.fromstationid}` })),
          ]);
        }
      } else if (stationtype === "transfer") {
        const connectedRoutes = await db.select("").from("se_project.routes").where("fromstationid", stationId).orWhere("tostationid", stationId);
        for (const route of connectedRoutes) {
          if (route.fromstationid === stationId) {
            await db("se_project.routes").where("id", route.id).update({ fromstationid: route.tostationid });
          } else {
            await db("se_project.routes").where("id", route.id).update({ tostationid: route.fromstationid });
          }
        }
      }
      const deleteStation = await db("se_project.stations").where("id", stationId).del().returning("");
      console.log("deleted", deleteStation);
      return res.status(200).json(deleteStation);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not delete station");
    }
  });


  // mazennnnnnnnn
app.post("/api/v1/route", async function (req, res) {
      try {
          const user = await getUser(req);
          if (!user.isAdmin) {
              return res.status(403).send("Only Admin can create routes.");
          }
          const { newStationId, connectedStationId, routeName } = req.body;
          const newStation = await db('se_project.stations').where('id', newStationId).first();
          const connectedStation = await db('se_project.stations').where('id', connectedStationId).first();
          if (!newStation || !connectedStation) {
              return res.status(400).send("Invalid Station ID");
          }
          if (newStation.stationposition === connectedStation.stationposition) {
              return res.status(400).send("Cannot create route between two start or end stations.");
          }
          const newRouteId = await db('se_project.routes').insert([
              { routename: routeName, fromstationid: newStationId, tostationid: connectedStationId },
          ]);
          return res.status(200).json({ id: newRouteId[0], message: "Route created successfully." });
      } catch (e) {
          console.log(e.message);
          return res.status(400).send("Could not create route.");
      }
  });



  app.put("/api/v1/route/:routeId", async (req, res) => {
    try {
      const { routeId } = req.params;
      const { routeName } = req.body;
      const updatedRoute = await db("se_project.routes")
        .where("id", routeId)
        .update({
          routename: routeName,
        })
        .returning("*");
        return res.status(200).json(updatedRoute);
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update route");
  }
  });


  app.delete("/api/v1/route/:routeId", async (req, res) => {
    try {
      const { routeId } = req.params;
      const deletedRoute = await db("se_project.routes").where("id", routeId).del().returning("*");
      console.log("deleted",deletedRoute);
      return res.status(200).json(deletedRoute);
  } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("failed to delete route");
  
    }
  });


  app.put("/api/v1/requests/refunds/:requestId", async (req, res) => {
    try {
      const { refundStatus } = req.body;
      const { requestId } = req.params;
      const updatedRefund_Requests = await db("refund_requests")
        .where("id", routeId)
        .update({
          refundStatus: refundStatus,
        })
        .returning("*");
        return res.status(200).json(updatedRefund_Requests);
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update route");
  }
  });
  app.put("/api/v1/requests/refunds/:requestId", async (req, res) => {
    try {
      const { seniorStaus } = req.body;
      const { requestId } = req.params;
      const updatedRefund_Requests = await db("refund_requests")
        .where("id", routeId)
        .update({
          seniorStaus: seniorStaus,
        })
        .returning("*");
        return res.status(200).json(updatedRefund_Requests);
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update route");
  }
  });

  app.put("/api/v1/zones/:zoneId", async (req, res) => {
    try {
      const { price } = req.body;
      const { zoneId } = req.params;
      const updatedZone_Price = await db("se_project.zones")
        .where("id", zoneId)
        .update({
          price: price,
        })
        .returning("*");
        return res.status(200).json(updatedZone_Price);
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update zones");
  }
  });

/////////////hajar
app.put('/api/v1/password/reset', async (req, res) => {

  try{
      const { newPassword } = req.body;
      const user = await getUser(req);  
      let id = user.userid;
      console.log(id)
      const updatedPassword = await db("se_project.users")
      .where("id", id)
      .update({ "password": newPassword})
      .returning("*");
      return res.status(200).json("updated Password");
  
  }
  catch (err) {
    
    console.log("error message", err.message);
    return res.status(400).send("Could not update password");
  
  }

    });

    app.get('/api/v1/zones', async (req, res) => {//////////////////////////
  
      try {
    
      const zone = await db.select("*").from("se_project.zones");
    console.log(zone)
      return res.status(200).json(zone);
    
    } catch (err) {
    
      console.log("error message", err.message);
      return res.status(400).send("Could not get zones");
    
    }
    });
    app.post("/api/v1/payment/subscription", async function (req, res) {
      try {
        const user = await getUser(req);
        const { creditCardNumber, holderName, payedAmount, subType, zoneId } = req.body;
    
        let noOfTickets;
        let pricePerTicket;
        switch (subType) {
          case "annual":
            noOfTickets = 100;
            pricePerTicket = zoneId === 1 ? 5 : zoneId === 2 ? 7 : zoneId === 3 ? 10 : null;
            break;
          case "quarterly":
            noOfTickets = 50;
            pricePerTicket = zoneId === 1 ? 2 : zoneId === 2 ? 3.5 : zoneId === 3 ? 5 : null;
            break;
          case "monthly":
            noOfTickets = 10;
            pricePerTicket = zoneId === 1 ? 0.5 : zoneId === 2 ? 0.7 : zoneId === 3 ? 1 : null;
            break;
          default:
            return res.status(400).send("Invalid subscription type.");
        }
    
        if (!pricePerTicket) {
          return res.status(400).send("Invalid zone id.");
        }
    
        if (payedAmount !== noOfTickets * pricePerTicket) {
          return res.status(400).send("Invalid payment amount.");
        }
    
        await db("se_project.subsription").insert({
          subtype: subType,
          zoneid: zoneId,
          userid: user.id,
          nooftickets: noOfTickets,
        });
    
        return res.status(200).json({ noOfTickets });
    
      } catch (e) {
        console.log(e.message);
        return res.status(400).send("Could not purchase subscription.");
      }
    });

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// HTTP Method : POST
// HTTP Endpoint Route : /api/v1/payment/ticket
// Request Body : {
// creditCardNumber:Integer,
// holderName:string,
// payedAmount:integer,
// origin:string,
// destination:string,
// tripDate: dateTime
// }

app.post('/api/v1/payment/ticket', async function (req, res) {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).send('Unauthorized');
    }

    // Get origin and destination station names from request body
    const { creditCardNumber, holderName, origin, destination, tripDate, payedAmount } = req.body;

    // Validate request body
    if (!creditCardNumber || !holderName || !origin || !destination || !tripDate || !payedAmount) {
      return res.status(400).send('Missing required fields');
    }

    // Retrieve origin and destination station IDs from database
    const originStation = await db('se_project.stations').where({ stationname: origin }).first();
    const destinationStation = await db('se_project.stations').where({ stationname: destination }).first();
    if (!originStation || !destinationStation) {
      return res.status(400).send('Invalid origin or destination station');
    }

    // Calculate number of stations passed
    const stationsPassed = Math.abs(destinationStation.stationposition - originStation.stationposition);

    // Calculate zone id based on number of stations passed
    let zoneId;
    if (stationsPassed <= 9) {
      zoneId = 1;
    } else if (stationsPassed <= 16) {
      zoneId = 2;
    } else {
      zoneId = 3;
    }

    // Get ticket price based on zone id from database
    const zone = await db('se_project.zones').where({ id: zoneId }).first();
    const ticketPrice = zone.price;

    // Check stations in between
    const middleStations = await db('se_project.stations').whereBetween('stationposition', [originStation.stationposition + 1, destinationStation.stationposition - 1]);

    // Calculate total ticket price
    let totalTicketPrice = ticketPrice;
    for (const station of middleStations) {
      const zone = await db('se_project.zones').whereRaw('? BETWEEN fromstation AND tostation', [station.stationposition]).first();
      totalTicketPrice += zone.price;
    }

    // Check if the user has enough balance
    if (payedAmount < totalTicketPrice) {
      return res.status(400).send('Not enough balance');
    }

    // Insert new ticket record into database
    const ticketId = await db('se_project.tickets').insert({
      origin: originStation.stationname,
      destination: destinationStation.stationname,
      userid: user.id,
      subid: user.subid,
      tripdate: tripDate,
    }).returning('id');

    // Return number of tickets to user in response body
    const numTickets = 1; // For now, assuming only one ticket can be purchased at a time
    return res.status(200).json({
      numTickets,
      ticketPrice: totalTicketPrice,
      zoneId,
      route: `${originStation.stationname} to ${destinationStation.stationname}`,
      transferStations: stationsPassed - 1,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).send('Could not purchase ticket');
  }
});

// HTTP Method : POST
// HTTP Endpoint Route : /api/v1/tickets/purchase/subscription
// Description: Pay for ticket by subscription
// Request Body : {
// subId:integer,
// origin:string,
// destination:string,
// tripDate: dateTime
// }

app.post('/api/v1/tickets/purchase/subscription', async (req, res) => {
  try {
    const { subId, origin, destination, tripDate } = req.body;
    const user = await getUser(req);

    // Check if user has a subscription
    const subscription = await db
      .select('*')
      .from('se_project.subsription')
      .where('id', subId)
      .andWhere('userid', user.id)
      .first();

    if (!subscription) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }

    // Calculate ticket price
    switch (subtype) {
      case 'annual':
        amount = 100;
        subscription.nooftickets--;
        nooftickets = subscription.nooftickets;
        break;
      case 'quarterly':
        amount = 50;
        subscription.nooftickets--;
        nooftickets = subscription.nooftickets;
        break;
      case 'monthly':
        amount = 20;
        subscription.nooftickets--;
        nooftickets = subscription.nooftickets;
        break;
      default:
        return res.status(400).send('Invalid subscription type');
    }

    // Calculate route and transfer stations
    const route = `${origin} - ${destination}`;
    const transferStations = ['Station A', 'Station B', 'Station C'];

    // Create new ticket
    const newTicket = {
      id: v4(),
      userId: user.id,
      subscriptionId: subId,
      origin,
      destination,
      tripDate,
      price,
      route,
      transferStations: JSON.stringify(transferStations),
    };

    const addedTicket = await db('se_project.tickets').insert(newTicket).returning('*');

    return res.status(200).json(addedTicket[0]);
  } catch (e) {
    console.log(e.message);
    return res.status(400).send('Could not purchase ticket');
  }
});


// HTTP Method: GET
// HTTP Endpoint Route: /api/v1/tickets/price/:originId & :destinationId
// Description: Check Price
// Request Body : EMPTY

// Get ticket price based on origin and destination

/*app.get("/api/v1/tickets/price/:originId/:destinationId", async function (req, res) {
    try {
      const user = await getUser(req);

      // get the origin and destination stations
      const origin = await db.select("*").from("se_project.stations").where("id", req.params.originId).first();
      const destination = await db.select("*").from("se_project.stations").where("id", req.params.destinationId).first();

      if (!origin || !destination) {
        return res.status(404).send("Origin and/or destination not found");
      }

      // find the routes that pass through the origin station
      const originRoutes = await db
        .select("*")
        .from("se_project.stationRoutes")
        .where("stationId", origin.id)
        .innerJoin("se_project.routes", "se_project.stationRoutes.routeId", "se_project.routes.id");

      let price = null;

      // loop through the routes to find the one that passes through the destination station
      for (const route of originRoutes) {
        const destinationRoute = await db
          .select("*")
          .from("se_project.stationRoutes")
          .where("routeId", route.routeId)
          .andWhere("stationId", destination.id)
          .first();

        if (destinationRoute) {
          price = route.price;
          break;
        }
      }

      if (!price) {
        return res.status(404).send("No route found between origin and destination");
      }

      return res.status(200).json({ price });
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get ticket price");
    }
  });
  function calculateTicketPrice(distance) {
    // Calculation of ticket price based on distance goes here
    let ticketPrice;
  const transferStations = ['Station A', 'Station B', 'Station C'];
  if (origin === destination) {
    return res.status(400).send('Origin and destination cannot be the same');
  } else if (!transferStations.includes(origin) || !transferStations.includes(destination)) {
    return res.status(400).send('Invalid origin or destination');
  } else if (origin === 'Station A' && destination === 'Station B') {
    ticketPrice = 5;
  } else if (origin === 'Station B' && destination === 'Station C') {
    ticketPrice = 7;
  } else if (origin === 'Station A' && destination === 'Station C') {
    ticketPrice = 10;
  }
  }
};
*/

app.get("/api/v1/tickets/price/:originId/:destinationId", async function (req, res) {
  try {
    const { originId } = req.params;
    const { destinationId } = req.params;
    console.log(req.params);
    const check = await db
      .select("*")
      .from("se_project.zones")
      .where("id", originId && destinationId)
    console.log(req.params.originId);
    console.log(req.params.destinationId);
    return res.status(200).json(check);
  } catch (err) {
    console.log("eror message", err.message);
    return res.status(404).send("failed to get this origin and destination id");
  }
});

app.post("/api/v1/senior/request", async (req, res) => {

  try {
    const user = await getUser(req);
        const {nationalid } = req.body;
    console.log(req.body);
    let newSenior = {
      status:"pending",
      userid:user.id,
      nationalid
    };
    const RequestSenior = await db("se_project.senior_requests").insert(newSenior).returning("*");
    console.log(RequestSenior);
    return res.status(200).json(RequestSenior);
  }
 catch (err) {
    console.log("error message", err.message);
    return res.status(400).send("error");
}
});

app.put("/api/v1/requests/refunds/:requestId", async (req, res) => {
  try {
    const { status } = req.body;
    const { requestId } = req.params;
    const updatedRefund_Requests = await db("se_project.refund_requests")
      .where("id", requestId)
      .update({
        status: status,
      })
      .returning("*");
      return res.status(200).json("updated status");
  } catch (err) {
    console.log("eror message", err.message);
    return res.status(400).send("Could not update status");
}
});
app.put("/api/v1/requests/senior/:requestId", async (req, res) => {
  try {
   
    const { status } = req.body;
    const { requestId } = req.params; 
   // if (!user.isSenior){
    const updatedRefund_Requests = await db("se_project.senior_requests")
      .where("id", requestId)
      .update({
        status: status
      })
      .returning("*");
    
      return res.status(200).json("senior status updated");
  } catch (err) {
    console.log("eror message", err.message);
    return res.status(400).send("Could not update route");
}
});





app.put("/api/v1/ride/simulate", async (req, res) => {
  try {
    const { origin, destination, tripdate } = req.body;
    const { ticketid } = req.params;
    const SimulateRide = await db("se_project.rides")

      .update({
        origin: origin,
        destination: destination,
        tripdate: tripdate,
      })
      .returning("*");
      return res.status(200).json(SimulateRide);
  } catch (err) {
    console.log("error message", err.message);
    return res.status(400).send("Could not simulate ride");
}
});








};
