// app/api/materials/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  connectToMongodbEquipment,
  connectToMongodbMaterials,
  connectToMongodbProperties,
  connectToMongodbHauling,
} from "../../lib/mongodb" // Assuming a separate connection for materials, similar to properties
import { MaterialsEntry, UpdateMaterialsEntry } from "@/app/models/EntrySchemas"
import { ObjectId } from "mongodb"
import { generateUniqueUrlEnd } from "@/app/lib/helpers"

// Define allowed origins
const allowedOrigins = ["http://localhost:3000"]

// Function to get CORS headers based on request origin
function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  if (allowedOrigins.includes(origin || "")) {
    corsHeaders["Access-Control-Allow-Origin"] = origin || ""
  }

  return corsHeaders
}

// Handle OPTIONS method for CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const corsHeaders = getCorsHeaders(request)
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}

// GET: Retrieve all materials entries or a specific one by _id or urlEnd
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("_id")
    const urlEnd = searchParams.get("urlEnd")

    const { db } = await connectToMongodbMaterials()

    if (id) {
      // Fetch a single material by _id
      const objectId = new ObjectId(id)
      const material = await db
        .collection<MaterialsEntry>("materials")
        .findOne({ _id: objectId })

      if (material) {
        return NextResponse.json(material)
      } else {
        return NextResponse.json(
          { message: "Material not found" },
          { status: 404 }
        )
      }
    } else if (urlEnd) {
      // Fetch a single material by `urlEnd`
      const material = await db
        .collection<MaterialsEntry>("materials")
        .findOne({ urlEnd })

      if (material) {
        return NextResponse.json(material)
      } else {
        return NextResponse.json(
          { message: "Material not found" },
          { status: 404 }
        )
      }
    } else {
      // Fetch all materials if no specific id or urlEnd is provided
      const materials = await db
        .collection<MaterialsEntry>("materials")
        .find({})
        .toArray()
      return NextResponse.json(materials)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching data from MongoDB:", error.message)
      return NextResponse.json(
        { message: `Failed to fetch data: ${error.message}` },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { message: "Unknown error occurred" },
      { status: 500 }
    )
  }
}

// POST: Create a new material
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const requestBody = await request.json()
    const {
      name,
      description,
      imageUrl,
      typesAndPrices,
      listingWebsites,
      urlEnd,
      isActive,
    } = requestBody

    const { db } = await connectToMongodbMaterials()
    const { db: dbHauling } = await connectToMongodbHauling()
    const { db: dbProperties } = await connectToMongodbProperties()
    const { db: dbEquipment } = await connectToMongodbEquipment()

    const uniqueUrlEnd = await generateUniqueUrlEnd(
      dbProperties,
      dbEquipment,
      db,
      dbHauling,
      urlEnd
    )

    const newMaterial: MaterialsEntry = {
      name,
      description,
      imageUrl,
      typesAndPrices,
      listingWebsites,
      urlEnd: uniqueUrlEnd,
      isActive,
    }

    const result = await db
      .collection<MaterialsEntry>("materials")
      .insertOne(newMaterial)

    return result.acknowledged
      ? NextResponse.json(
          { message: "Material added successfully", _id: result.insertedId },
          { status: 201 }
        )
      : NextResponse.json(
          { message: "Failed to add material" },
          { status: 500 }
        )
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching data from MongoDB:", error.message)
      return NextResponse.json(
        { message: `Failed to fetch data: ${error.message}` },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { message: "Unknown error occurred" },
      { status: 500 }
    )
  }
}

// PUT: Update a material by _id
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const requestBody = await request.json()
    const { _id, ...updateData } = requestBody

    if (!_id)
      return NextResponse.json({ message: "_id is required" }, { status: 400 })

    const { db } = await connectToMongodbMaterials()
    const objectId = new ObjectId(_id)

    const updateObject = {
      $set: {
        ...updateData,
        typesAndPrices: updateData.typesAndPrices || [],
      },
    }

    const result = await db
      .collection<MaterialsEntry>("materials")
      .updateOne({ _id: objectId }, updateObject, { upsert: true })

    return NextResponse.json(
      {
        message: result.modifiedCount
          ? "Material updated successfully"
          : "No changes made",
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error handling PUT request:", error.message)
      return NextResponse.json(
        { message: `Failed to update material: ${error.message}` },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { message: "Unknown error occurred" },
      { status: 500 }
    )
  }
}

// DELETE: Delete a material by _id
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("_id")

    if (!id) {
      return NextResponse.json({ message: "_id is required" }, { status: 400 })
    }

    const { db } = await connectToMongodbMaterials()

    // Cast _id to ObjectId
    const objectId = new ObjectId(id)

    // Delete the material using _id
    const result = await db
      .collection<MaterialsEntry>("materials")
      .deleteOne({ _id: objectId })

    if (result.deletedCount === 1) {
      return NextResponse.json(
        { message: "Material deleted successfully" },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { message: "Material not found" },
        { status: 404 }
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error handling DELETE request:", error.message)
      return NextResponse.json(
        { message: `Failed to delete material: ${error.message}` },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { message: "Unknown error occurred" },
      { status: 500 }
    )
  }
}
