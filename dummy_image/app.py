from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, from the backend image, fe2'

@app.route('/frontend/test')
def hello_be():
    return 'Hello, from the /frontend/test image, fe2'

@app.route('/frontend/')
def hello_be1():
    return 'Hello, from the frontend/ image, fe2'


## Build and push image to aws ecr
# cd to root folder of project
# sudo docker build -t randserver . 
# 'randserver' (could be any other name) is the name of the creted docker image and tag is automatically latest
# docker tag randserver:latest {aws-account-id}.dkr.ecr.eu-west-2.amazonaws.com/randserver:tag10
# tag10 is the tag of the created alias that will be pushet to aws ecr
# docker push {aws-account-id}.dkr.ecr.eu-west-2.amazonaws.com/randserver:tag10

# run the docker image localy and map the ports
# docker run --publish 5000:5000 randserver

