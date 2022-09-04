import express, {json} from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from "dotenv";
import dayjs from 'dayjs';
import cors from 'cors';
import joi from 'joi';

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect(() => {
    db = mongoClient.db('batepapoUOL');
});

const server = express();
server.use(cors());
server.use(json());

const nameSchema = joi.string().empty().required();
const messageSchema = joi.object({
    to: joi.string().empty().required(),
    text: joi.string().empty().required(),
    type: joi.string().valid('message', 'private_message').required()
});
/* const filterMessagesSchema = joi.object({
    _id: joi.required(),
    from: joi.required(),
    to: joi.string().valid(user,'Todos').required(),
    text: joi.required(),
    type: joi.required(),
    time: joi.required()
}); */

function validationMessage(user, message){
    const {from, to} = message;
    if(from === user || to === user || to === 'Todos'){
        return true;
    } else{
        return false;
    }
}

server.post("/participants", async (req,res) => {
    
    const {name} = await req.body;
    const validation = nameSchema.validate(name, {abortEarly: false});

    if(validation.error){
        return res.sendStatus(422);
    };

    try{
        
        const participant = await db.collection('participants').findOne({name: name}); 

        if(participant){
            return res.sendStatus(409);
        };
        
        await db.collection('participants').insertOne({name: name, lastStatus: Date.now()});
        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().locale('br').format('HH:mm:ss')
        });

        return res.sendStatus(201);

    }catch(error){

        console.error(error);
        return res.sendStatus(500);
    }
});

server.get("/participants", async (req, res) => {
    
    try{
        const participants = await db.collection('participants').find().toArray();
        return res.send(participants);

    }catch(error){
        console.error(error);
        return res.sendStatus(500);
    }
});

server.post("/messages", async (req, res) => {

    const {to, text, type} = req.body;
    const {user} = req.headers;
    const message = {to, text, type};

    const validation = messageSchema.validate(message, {abortEarly: false});
    const participant = await db.collection('participants').findOne({name: user})
    
    if(validation.error){
        validation.error.details.map(err => {
            console.log(err);
        });
        return res.sendStatus(422);
    } else if(participant === null){
        return res.sendStatus(422);
    }

    try{
        await db.collection('messages').insertOne({
            from: user,
            ...message,
            time: dayjs().locale('br').format('HH:mm:ss')
        });

        return res.sendStatus(201);
    }catch(error){
        console.error(error);
        return res.sendStatus(500);
    };
});

server.get("/messages", async (req, res) => {
    const {user} = req.headers;
    const {limit} = req.query;
    
    try {

        const messages = await db.collection('messages').find().toArray();
        const array = messages.filter(message => {
            const {from, to} = message;
            return (from === user || to === user || to === 'Todos')
        });
        return res.send(array.slice(-limit));
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});



server.listen(5000);
