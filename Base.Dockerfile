FROM apify/actor-node-chrome

# Copy source code
COPY package.json ./

# Install default dependencies, print versions of everything
RUN npm --quiet set progress=false \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version \
 && NODE_ENV=development npm install --no-optional



# By default, the apify/actor-node-chrome image uses "npm start" to run the code.
# You can override this behavior using the CMD instruction here:
# CMD [ "" ]
