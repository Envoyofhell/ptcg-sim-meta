const path = require('path');

module.exports = {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/front-end.js',
    devtool: 'source-map', // Added for better debugging
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        publicPath: '/' // This ensures assets are served from the root
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpe?g|gif|svg|woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/[name][ext]'
                }
            },
            // Add source map loader
            {
                test: /\.js$/,
                enforce: 'pre',
                use: ['source-map-loader']
            }
        ]
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@frontend': path.resolve(__dirname, 'src/front-end.js'),
            '@globals': path.resolve(__dirname, 'src/initialization/global-variables/global-variables.js')
        },
        extensions: ['.js', '.json']
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
            publicPath: '/', // Ensure assets are served from root
        },
        hot: true,
        port: 3000,
        open: true,
        historyApiFallback: true
    }
};