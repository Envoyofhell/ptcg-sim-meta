const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/front-end.js',
    devtool: 'source-map',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
        publicPath: '/'
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
                test: /\.(png|jpe?g|gif|svg|ico|woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/[name][hash][ext]'
                }
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                // Copy CSS files
                { 
                    from: 'src/css', 
                    to: 'css' 
                },
                // Copy JS files
                { 
                    from: 'src/*.js', 
                    to: '[name][ext]' 
                },
                // Copy assets
                { 
                    from: 'src/assets', 
                    to: 'assets' 
                },
                // Copy HTML files if they exist
                {
                    from: '*.html',
                    context: 'src',
                    to: '[name][ext]',
                    noErrorOnMissing: true
                }
            ]
        })
    ],
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
            publicPath: '/'
        },
        hot: true,
        port: 3000,
        open: true,
        historyApiFallback: true
    }
};