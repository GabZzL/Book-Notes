import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import { config } from "dotenv";
import pg from "pg";

config();

const { Pool } = pg;

const app = express();
const port = 3000;

const connectionString = process.env.DATABASE_URL;

const db = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

db.connect();

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const coversApiUrl = "https://covers.openlibrary.org/b/";

let coversUrlArray = new Array;
let isbnArray = new Array;

let selectorBooks = "";

async function getBookData(id){
    try{
        const result = await db.query(
            "SELECT * FROM book_data WHERE id = $1",
            [id]
    );
    return result.rows;
    } catch(error){
        console.log('Error to access to the blog data:', error);
    };
};

async function getBooksData(selector){
    try{
        const result = await db.query(`SELECT * FROM book_data ORDER BY ${selector} DESC`);
        return result.rows;
    } catch(error){
        console.error('Error to access to the blogs data:', error);
    };
};

async function getOpinionAuthor(id){
    try{
        const result = await db.query(
            "SELECT opinion, author_link FROM book_opinion WHERE book_id = $1",
            [id]
        );
        return result.rows;
    } catch(error){
        console.error('Error to acces to the oponion data', error);
    };
};

async function getCover(isbnValue){
    try {
        const result = await axios.get(coversApiUrl + `isbn/${isbnValue}.json`);
        return result.data;
    } catch{
        console.error("Faile Get Request:", error.message);
        throw error;
    };
};

async function getCovers(isbnArray) {
    for (const isbn of isbnArray) {
        try {
            const result = await getCover(isbn);
            coversUrlArray.push(result.source_url);
        } catch (error) {
            console.error('Error processing cover for', isbn, ':', error);
        };
    };
};

app.get("/", async(req, res) => {

    coversUrlArray = [];
    isbnArray = [];

    selectorBooks = "id"
 
    const booksData = await getBooksData(selectorBooks);

    for (const data of booksData) {
        const isbn = data.isbn;
        isbnArray.push(isbn);
    };

    await getCovers(isbnArray);
   
    res.render("index.ejs", {
        booksData: booksData,
        covers: coversUrlArray,
    });
});

app.post("/blog", async(req, res) => {
    const blogId = req.body.blogId;
    const imageNumber = req.body.imageNumber;

    const bookData = await getBookData(blogId);
    const bookDetails = await getOpinionAuthor(blogId)
 
    res.render("partials/blog.ejs", {
        book: bookData[0],
        cover: coversUrlArray[imageNumber],
        opinion: bookDetails[0].opinion,
        authorUrl: bookDetails[0].author_link
    });
});

app.post("/order", async(req, res) => {
    coversUrlArray = [];
    isbnArray = [];

    const orderBy = req.body.orderBy;

    if(orderBy === "Number Rate"){
        selectorBooks = "rate_number";
    } else if(orderBy === "Recent Date"){
        selectorBooks = "read_date";
    };

    const booksData = await getBooksData(selectorBooks);

    for (const data of booksData) {
        const isbn = data.isbn;
        isbnArray.push(isbn);
    };

    await getCovers(isbnArray);

    res.render("index.ejs", {
        booksData: booksData,
        covers: coversUrlArray,
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});