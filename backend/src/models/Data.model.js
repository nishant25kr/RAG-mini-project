import mongoose from "mongoose";

const DataSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        required: true
    }
}, { timestamps: true })

export default mongoose.model("Data",DataSchema)