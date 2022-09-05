import { stripHtml } from 'string-strip-html';
import express, {json} from 'express';
import { MongoClient } from 'mongodb';
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

server.post("/participants", async (req,res) => {
    
    const {name} = await req.body;
    const validation = nameSchema.validate(name, {abortEarly: false});

    if(validation.error){
        return res.sendStatus(422);
    };

    try{
        
        const sanitizedName = stripHtml(name).result.trim();
        const participant = await db.collection('participants').findOne({name: sanitizedName}); 

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
    const message = {
        to, 
        text, 
        type
    };

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
        const sanitizedUser = stripHtml(user).result.trim();
        const sanitizedTo = stripHtml(to).result.trim();
        const sanitizedText = stripHtml(text).result.trim();
        const sanitizedType = stripHtml(type).result.trim();

        await db.collection('messages').insertOne({
            from: sanitizedUser,
            sanitizedTo,
            sanitizedText,
            sanitizedType,
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

server.post("/status", async (req,res) => {
    
    const {user} = req.headers; 
    
    try {
        const participant = await db.collection('participants').findOne({name: user});
        
        if(!participant){
            return res.sendStatus(404);
        };

        await db.collection('participants').updateOne(
            {name: user},
            {
              $set: { lastStatus: Date.now() }
            }
        );
        return res.sendStatus(200);

    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }   
});

setInterval( async () => {

    const participants = await db.collection('participants').find().toArray();
    const inactiveUsers = participants.filter((participant) => {
        return participant.lastStatus < Date.now() - 10000;
    });
    inactiveUsers.forEach( async (user, i) => {
        
        await db.collection('participants').deleteOne({_id: user._id});
        await db.collection('messages').insertOne({
            from: user.name, 
            to: 'Todos', 
            text: 'sai da sala...', 
            type: 'status', 
            time: dayjs().locale('br').format('HH:mm:ss')
        });
    });       
}, 15000);

server.listen(5000);
