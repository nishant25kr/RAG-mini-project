import mongoose from "mongoose";

const pdfSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required: true
        },
        embedding:{
            type:[Number],
            required:true
        }
    },
    {
        timestamps: true
    }
)


export default mongoose.model("PdfSchema", pdfSchema);

