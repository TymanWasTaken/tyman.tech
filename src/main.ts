import express from 'express'
const app = express(); 
const port = 8738;
app.get( "/", ( req, res ) => {
    res.send( "soon™" );
} );
// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${ port }` );
} );
