///////////////////////////////////////////////////////////////////////////////
// Library application / micro service
///////////////////////////////////////////////////////////////////////////////

// Library resources, route declarations => services configurations
require('./express.routes');
// TODO: Rename to:
//require('./library-routes.express');

// Library application store (read-only queries only) (based on MongoDB)
require('./library-application-store.mongodb');
