// Endpoint for purchasing tickets through online payment
app.post('/api/v1/payment/ticket', async (req, res) => {
    try {
      const { purchasedId, creditCardNumber, holderName, payedAmount, origin, destination, tripDate } = req.body;
  
      // Perform necessary validations and calculations
      // ...
  
      // Store the ticket information in the database
      const ticket = {
        origin,
        destination,
        userid: 123, // Replace with the actual user ID
        tripdate: new Date(tripDate)
      };
      const addedTicket = await db('se_project.tickets').insert(ticket).returning('');
  
      // Return the response
      return res.status(200).json(addedTicket);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to purchase ticket' });
    }
  });
  
  // Endpoint for purchasing tickets through subscriptions
  app.post('/api/v1/tickets/purchase/subscription', async (req, res) => {
    try {
      const { subId, origin, destination, tripDate } = req.body;
  
      // Perform necessary validations and calculations
      // ...
  
      // Store the ticket information in the database
      const ticket = {
        origin,
        destination,
        userid: 123, // Replace with the actual user ID
        subId,
        tripdate: new Date(tripDate)
      };
      const addedTicket = await db('se_project.tickets').insert(ticket).returning('');
  
      // Return the response
      return res.status(200).json(addedTicket);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to purchase ticket' });
    }
  });
  
  // Endpoint for checking the price of a ticket
  app.get('/api/v1/tickets/price/:originId&:destinationId', async (req, res) => {
    try {
      const { originId, destinationId } = req.params;
  
      // Fetch the price information from the database
      const priceInfo = await db('se_project.zones')
        .select('price')
        .where('id', originId)
        .orWhere('id', destinationId);
  
      // Perform necessary calculations
      // ...
  
      // Return the response
      return res.status(200).json(priceInfo);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to check ticket price' });
    }
  });
  
  // Start the server
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });