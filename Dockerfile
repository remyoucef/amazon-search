FROM remyoucef/amazon-search-apify-actor:base

# Copy source code
COPY . ./

# Install default dependencies, print versions of everything
RUN npm --quiet set progress=false \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version



# By default, the apify/actor-node-chrome image uses "npm start" to run the code.
# You can override this behavior using the CMD instruction here:
 CMD [ "npm","run", "start:dev" ]
