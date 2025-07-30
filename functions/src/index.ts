/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

type Indexable = { [key: string]: string };

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = onRequest((request, response) => {
    const foo = request.params[0].replace("/", "");
    const items: Indexable = {
        lamp: "This is a lamp",
        table: "This is a table" 
    };
    logger.info("Hello logs!\n", foo, {structuredData: true});
    const message = items[foo] || "No item found";
    response.send(`<h1>${message}></h1>`);
});
