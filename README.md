# distributed_llm

This is an llm interface application to run query against llm models running locally using ollama.

This is the architecture diagram of the process:

![image](https://github.com/user-attachments/assets/fab74159-3a49-469f-b35c-c478fb7b5bef)

The consumer.html (the UI ) is hosted by the master-server.js

master-server.js has four apis:

/query  [is called by the UI when prompt is submitted, master-server put the query in a queue just returns a transactionid]
/is_query_result_available [is also called by UI again and again after a query is submitted with the transactionId to check if result is available]
/give_me_query [the slave-server calls this again and again, and if master-server.js has any query in its queue it replies with that]
/take_the_response [once slave-server gets a query in the response of above api, it calls ollama api to send the prompt to the llm model and once it replies slave calls this enpoint to notify master with the llm response]



In local setup this is how you can run:

```
git clone https://github.com/devashish234073/distributed_llm
cd distributed_llm
node master-server.js
node slave-server.js http://localhost:3000
access the UI application from browser at localhost:3000
#make sure ollama is running and you have the model name present in slave-server.js installed locally by doing "ollama run <model-name>"
```
In cloud setup:

```
Create a cloudformation stack using master-cloudformation.json
#this is sufficient to put the master-server.js to cloud
the UI can be accessed at <public-ip-of-the-instance>:3000
In local or multiple locals start the slave-server.js by runing 
node slave-server.js http://<public-ip-of-the-instance>:3000
#make sure ollama is running and you have the model name present in slave-server.js installed locally by doing "ollama run <model-name>"
```




