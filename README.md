# DataMerchStore API

## Install
The code assumes you have git, node.js and npm installed on the system.
```
$ git clone git@github.com:kodifiera/D0018E-api.git
$ cd D0018E-api
$ npm install
```
By default the code should run at localhost:3000.

## Run locally with hot reload
```
$ npm run dev
```


## Deploy to staging server
For deployment to staging server a very secret password is required. But the general idea is the following. Currently only master branch is used for staging, but potentially different branches could be used for dev, staging and production.

```
$ git remote add staging ssh://peter@37.123.187.130:1122/srv/git/d0018e-api.git
$ git push staging master 
```