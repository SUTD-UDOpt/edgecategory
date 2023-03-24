const {readFile, readFileSync} = require('fs');
const cors = require('cors')
const spawner = require('child_process').spawn;
const express = require('express');

// start express server at localhost 3000
const app = express();
app.listen(3000, () => console.log('http://localhost:3000'))
app.use(cors({origin:'http://localhost:3000', credentials : true}));

// import libraries
app.use('/static', express.static('./static'))
app.use(express.json());

// server immidiately 'gets' home.html and send it to client browser.
app.get('/', (request, response) => {
    readFile('./index.html','utf8', (err,html) => {
        response.send(html)
    })
});

// do something when a call to '/api_python' comes from client side.
app.post('/api_python', (request,response) => {
    try{
        // use spawner to run python using the incoming json request, after formatting with stringify.
        const python_process = spawner('python',['./Optimise.py', JSON.stringify(request.body)]);
        // if python printed something, print the output
        var newsItems = '';
        python_process.stdout.on("data", function (data) {
            newsItems += data.toString();
        });

        python_process.stdout.on("end", function () {
            if (newsItems.includes("failed")){
                console.error(`Not possible to build...`);
                response.json({data:0});
            } else {
                console.log("here")
                console.log(newsItems)
                console.log("there")
                try {
                    var jsonParse = JSON.parse(newsItems);
                    console.log(jsonParse);
                    response.json(jsonParse);
                } catch(error){
                    console.log(error)
                    // console.error(`Unexpected end of json input...`);
                    response.json({data:1});
                }
            }
        });
    } catch(error) {
        console.error(`Something is very wrong...`);
    }
});