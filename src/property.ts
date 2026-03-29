import { BaseProperty, PropertyType } from 'adminjs'

const ID_PROPERTY = '_id'
const VERSION_KEY_PROPERTY = '__v'

class Property extends BaseProperty {
  // TODO: Fix typings
  public mongoosePath: any

  constructor(path, position = 0) {
    super({ path: path.path, position })
    this.mongoosePath = path
  }

  instanceToType(mongooseInstance) {
    switch (mongooseInstance) {
      case 'String':
        return 'string'
      case 'Boolean':
        return 'boolean'
      case 'Number':
        return 'number'
      case 'Date':
        return 'datetime'
      case 'Embedded':
        return 'mixed'
      case 'ObjectID':
      case 'ObjectId':
        if (this.reference()) {
          return 'reference'
        }
        return 'id' as PropertyType
      case 'Decimal128':
        return 'float'
      default:
        return 'string'
    }
  }

  name() {
    return this.mongoosePath.path
  }

  isEditable() {
    return this.name() !== VERSION_KEY_PROPERTY && this.name() !== ID_PROPERTY
  }

  /**
   * Mongoose 9 removed `caster` for arrays in some cases.
   * We support both:
   * - Mongoose <= 8: mongoosePath.caster
   * - Mongoose 9+: mongoosePath.embeddedSchemaType / $embeddedSchemaType / fallbacks
   */
  private getEmbeddedSchema() {
    // Mongoose <= 8
    if (this.mongoosePath?.caster?.schema) return this.mongoosePath.caster.schema

    // Mongoose 9+
    const est =
      this.mongoosePath?.embeddedSchemaType ??
      this.mongoosePath?.$embeddedSchemaType ??
      this.mongoosePath?.schema?.$embeddedSchemaType

    if (est?.schema) return est.schema

    // Fallbacks (depending on Mongoose internal structures)
    const ctor =
      this.mongoosePath?.casterConstructor ??
      this.mongoosePath?.Constructor

    if (ctor?.schema) return ctor.schema

    return undefined
  }

  private getArrayRef() {
    // Mongoose <= 8
    if (this.mongoosePath?.caster?.options?.ref) return this.mongoosePath.caster.options.ref

    // Mongoose 9+
    const est =
      this.mongoosePath?.embeddedSchemaType ??
      this.mongoosePath?.$embeddedSchemaType ??
      this.mongoosePath?.schema?.$embeddedSchemaType

    if (est?.options?.ref) return est.options.ref

    // Fallbacks
    const ctor =
      this.mongoosePath?.casterConstructor ??
      this.mongoosePath?.Constructor

    if (ctor?.schema?.options?.ref) return ctor.schema.options.ref

    return undefined
  }

  reference() {
    const ref = this.isArray()
      ? this.getArrayRef()
      : this.mongoosePath.options?.ref

    if (typeof ref === 'function') return ref.modelName
    return ref
  }

  isVisible() {
    return this.name() !== VERSION_KEY_PROPERTY
  }

  isId() {
    return this.name() === ID_PROPERTY
  }

  availableValues() {
    return this.mongoosePath.enumValues?.length ? this.mongoosePath.enumValues : null
  }

  isArray() {
    return this.mongoosePath.instance === 'Array'
  }

  subProperties() {
    if (this.type() === 'mixed') {
      const schema = this.getEmbeddedSchema()
      if (!schema?.paths) return []

      const subPaths = Object.values(schema.paths)
      return subPaths.map((p) => new Property(p))
    }
    return []
  }

  type() {
    if (this.isArray()) {
      // Mongoose <= 8
      let instance = this.mongoosePath?.caster?.instance

      // For array of embedded schemas mongoose returns null for caster.instance
      if (!instance && this.mongoosePath?.caster?.schema) {
        instance = 'Embedded'
      }

      // Mongoose 9+: arrays of subdocuments expose embeddedSchemaType / $embeddedSchemaType
      if (!instance) {
        const est =
          this.mongoosePath?.embeddedSchemaType ??
          this.mongoosePath?.$embeddedSchemaType ??
          this.mongoosePath?.schema?.$embeddedSchemaType

        if (est?.schema) instance = 'Embedded'
        else if (est?.instance) instance = est.instance
      }

      // Last fallback: Constructor / casterConstructor
      if (!instance) {
        const ctor =
          this.mongoosePath?.casterConstructor ??
          this.mongoosePath?.Constructor
        if (ctor?.schema) instance = 'Embedded'
      }

      // Avoid crash if unknown
      if (!instance) instance = 'String'

      return this.instanceToType(instance)
    }

    return this.instanceToType(this.mongoosePath.instance)
  }

  isSortable() {
    return this.type() !== 'mixed' && !this.isArray()
  }

  isRequired() {
    return !!this.mongoosePath.validators?.find?.((validator) => validator.type === 'required')
  }
}

export default Property
