const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userid', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleid', 'se_project.roles.id')
    .first();
  
  console.log('user =>', user)
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;

  return user;  
}


module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard',{... user});
  });
  
  app.get('/users/add', async function(req, res) {
    const user = await getUser(req);
    return res.render('add-user',{... user});
  });
  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select('*').from('se_project.users');
    const user = await getUser(req);

    return res.render('users', { users ,...user});
  });

  // Register HTTP endpoint to render /courses page
  app.get('/stations_example', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('stations_example', { ...user, stations });
  });

 //Register HTTP endpoint to render /courses page

  app.get('/login', async function(req, res) {
  const user = await getUser(req);
  const name = await db.select('email','password').from('se_project.users');
  return res.render('login', user);
});


app.get('/register', async function(req, res) {
  const user = await getUser(req);
  const register = await db.select('*').from('se_project.users');
  return res.render('register', user);
});

app.get('/resetpassword', async function(req, res) {
  const user = await getUser(req);
  res.render('resetPassword', {...user});
});

// Define routes for regular user
app.get('/subscriptions', async function(req, res) {
  const user = await getUser(req);
  const subscription = await db.select('*').from('se_project.subsription');
  res.render('subscriptions',{...user, subscription}); 
});

app.get('/purchase/subscriptions', async function(req, res) {
  const user = await getUser(req);
  res.render('purchaseSubscription',{...user}); 
});

app.get('/tickets', function(req, res) {
  // render view for managing tickets
});

app.get('/prices', function(req, res) {
  // render view for managing prices
});

app.get('/rides', function(req, res) {
  // render view for managing rides
});

app.get('/requests/refund', function(req, res) {
  // render view for managing refund requests
});

app.get('/requests/senior', async function(req, res) {
  const user = await getUser(req);
  res.render('Senior', {...user});
});
// Define routes for admin user
app.get('/manage/stations/create', async function(req, res) {
  const user = await getUser(req);
  res.render('ManageCreateStation',{...user});
});

app.get('/manage/stations/edit/:stationId', async function(req, res) {
  const user = await getUser(req);
  res.render('updatestation',{...user});
});

app.get('/manage/routes', async function(req, res) {
  const user = await getUser(req);
  const routes = await db.select('*').from('se_project.routes');
  return res.render('viewRoutes', { ...user, routes });
});

app.get('/manage/routes/create', async function(req, res) {
  const user = await getUser(req);
  res.render('createRoute',{...user});
});

app.get('/manage/routes/edit/:routeId', async function(req, res) {
  const user = await getUser(req);
  res.render('updateroutes',{...user});
});

app.get('/manage/requests/refunds', function(req, res) {
  // render view for managing refund requests
});

app.get('/manage/requests/seniors/:requestId',async function(req, res) {
  const user = await getUser(req);
  res.render('manageSenior',{...user});
});

app.get('/manage/zones', async function(req, res) {
  const user = await getUser(req);
  const zone = await db.select('*').from('se_project.zones');
  res.render('zones',{...user, zone});
});

app.get('/manage/zones/edit/:zoneId', async function(req, res) {
  const user = await getUser(req);
  res.render('updateZones',{...user});
});

};

