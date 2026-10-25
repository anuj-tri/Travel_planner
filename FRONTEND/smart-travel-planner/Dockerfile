#Stage 1 : Build the Angular application
FROM node:20-apline AS build

WORKDIR /app

#copy packages file first for better build casching
COPY package.json package-lock.json ./

#install depedencies from the lockfile
RUN npm ci

#copy the angular source code
COPY . .

#Create the production build
RUN npm run build

#stage 2: Serve the build using Nginx
FROM nginx:alpine

#copy Angular's produvtion browser output
COPY --from=build /app/dist/smart-travel-planner/browser/ /usr/share/nginx/html/

#copy nginx cnfiguration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
